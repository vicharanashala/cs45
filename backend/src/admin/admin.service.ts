import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../users/user.schema';
import { FaqDocument } from '../faqs/faq.schema';
import { QuestionDocument } from '../questions/question.schema';
import { AnswerDocument } from '../questions/answer.schema';
import { FeedbackDocument } from '../faqs/feedback.schema';
import { NotificationDocument } from '../users/notification.schema';
import { ModerationLogDocument } from './moderation-log.schema';
import { AiService } from '../ai/ai.service';
import { VectorStoreService } from '../ai/vector-store.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('Faq') private readonly faqModel: Model<FaqDocument>,
    @InjectModel('Question') private readonly questionModel: Model<QuestionDocument>,
    @InjectModel('Answer') private readonly answerModel: Model<AnswerDocument>,
    @InjectModel('Feedback') private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel('Notification')
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel('ModerationLog')
    private readonly moderationLogModel: Model<ModerationLogDocument>,
    private readonly aiService: AiService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  /**
   * Aggregates platform statistics for the Admin dashboard.
   */
  async getAnalytics() {
    const totalUsers = await this.userModel.countDocuments();
    const totalFaqs = await this.faqModel.countDocuments({ approvedBy: { $ne: null } });
    const totalGenericQuestions = await this.questionModel.countDocuments({ type: 'generic' });
    const resolvedGenericQuestions = await this.questionModel.countDocuments({
      type: 'generic',
      isClosed: true,
    });
    const totalPersonalQueries = await this.questionModel.countDocuments({ type: 'personal' });

    const feedbacks = await this.feedbackModel.find();
    const helpfulFeedbacks = feedbacks.filter((f) => f.isHelpful).length;
    const feedbackSatisfaction =
      feedbacks.length > 0 ? Math.round((helpfulFeedbacks / feedbacks.length) * 100) : 100;

    return {
      usersCount: totalUsers,
      faqsCount: totalFaqs,
      questionsCount: totalGenericQuestions,
      resolvedQuestionsCount: resolvedGenericQuestions,
      personalQueriesCount: totalPersonalQueries,
      helpfulFeedbackCount: helpfulFeedbacks,
      totalFeedbackCount: feedbacks.length,
      satisfactionRate: feedbackSatisfaction,
    };
  }

  async getAllUsers() {
    return this.userModel.find().select('-passwordHash').sort({ createdAt: -1 });
  }

  /**
   * Suspends or restores a user account, logging the action for compliance audits.
   */
  async toggleUserBan(adminId: string, userId: string, reason: string) {
    if (adminId.toString() === userId.toString()) {
      throw new BadRequestException('Administrators cannot suspend their own profiles');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    user.isBanned = !user.isBanned;
    await user.save();

    const log = new this.moderationLogModel({
      moderatorId: adminId,
      action: user.isBanned ? 'ban_user' : 'unban_user',
      targetId: userId,
      reason: reason || (user.isBanned ? 'Policy violation' : 'Account restoration'),
    });
    await log.save();

    return { banned: user.isBanned, user };
  }

  /**
   * Retrieves all private, sensitive user inquiries routed to admins.
   */
  async getPersonalQueries() {
    const questions = await this.questionModel
      .find({ $or: [{ type: 'personal' }, { adminReviewRequested: true }] })
      .populate('author', 'name email reputationPoints')
      .sort({ createdAt: -1 });

    const questionIds = questions.map((q) => q._id.toString());
    const answers = questionIds.length
      ? await this.answerModel
          .find({ questionId: { $in: questionIds }, isAccepted: true })
          .populate('author', 'name role')
          .sort({ createdAt: -1 })
      : [];

    const answerByQuestion = new Map<string, any>();
    for (const answer of answers) {
      const key = answer.questionId.toString();
      if (!answerByQuestion.has(key)) {
        answerByQuestion.set(key, answer);
      }
    }

    return questions.map((question) => {
      const latestAnswer = answerByQuestion.get(question._id.toString()) || null;
      return {
        ...question.toObject(),
        latestAnswer: latestAnswer
          ? {
              _id: latestAnswer._id,
              content: latestAnswer.content,
              isAccepted: latestAnswer.isAccepted,
              createdAt: latestAnswer.createdAt,
              author: latestAnswer.author,
            }
          : null,
      };
    });
  }

  /**
   * Resolves a confidential customer inquiry by submitting a direct reply,
   * approving the post status, and triggering an inbox notification.
   */
  async reviewPersonalQuery(
    adminId: string,
    queryId: string,
    responseDto: { answerContent: string; isValid?: boolean },
  ) {
    const question = await this.questionModel.findById(queryId);
    if (!question || (question.type !== 'personal' && !question.adminReviewRequested)) {
      throw new NotFoundException('Personal query not found');
    }

    const answer = new this.answerModel({
      questionId: queryId,
      author: adminId,
      content: responseDto.answerContent,
      isAccepted: true,
      isModerated: false,
    });
    await answer.save();

    question.moderationStatus = 'approved';
    question.isClosed = true;
    await question.save();
    
    // SP Betting Resolution
    let extraMessage = '';
    if (question.adminReviewRequested && question.adminReviewBetSp > 0) {
      const user = await this.userModel.findById(question.author);
      if (user) {
        if (responseDto.isValid) {
          // Win: escrow + 2x bet
          const winSp = question.adminReviewBetSp * 3;
          user.reputationPoints += winSp;
          extraMessage = ` You won your bet! +${question.adminReviewBetSp * 2} SP net gain.`;
        } else {
          // Lose: lose another 1x bet
          const loseSp = question.adminReviewBetSp;
          user.reputationPoints = Math.max(0, user.reputationPoints - loseSp);
          extraMessage = ` Your query was marked duplicate/invalid. You lost your bet (-${question.adminReviewBetSp * 2} SP net loss).`;
        }
        await user.save();
      }
    }

    // Notify user of private query resolution
    const notification = new this.notificationModel({
      recipient: question.author.toString(),
      title: 'Private Query Resolved',
      message: `Your sensitive query "${question.title.substring(0, 30)}..." has been reviewed and answered by an administrator.${extraMessage}`,
      type: 'moderation',
      isRead: false,
    });
    await notification.save();

    // Log moderation action
    const log = new this.moderationLogModel({
      moderatorId: adminId,
      action: 'moderate_answer',
      targetId: queryId,
      reason: 'Resolved confidential support query',
    });
    await log.save();

    return { success: true };
  }

  /**
   * Synthesizes community debate summaries to compile a pending FAQ candidate.
   */
  async generateFaqFromDiscussion(adminId: string, discussionId: string) {
    const question = await this.questionModel.findById(discussionId);
    if (!question) {
      throw new NotFoundException('Discussion board not found');
    }

    const answers = await this.answerModel.find({ questionId: discussionId });
    if (answers.length === 0) {
      throw new BadRequestException('Discussions without answer entries cannot generate FAQs.');
    }

    const answerTexts = answers.map((a) => a.content);

    // AI dynamic FAQ builder
    const generated = await this.aiService.generateFaqFromDiscussion(
      question.title,
      answerTexts,
    );

    // Save as dynamic FAQ candidate (approvedBy = null indicates pending approval)
    const embedding = await this.aiService.generateEmbeddings(generated.question);

    const faqCandidate = new this.faqModel({
      question: generated.question,
      answer: generated.answer,
      embedding,
      isGenerated: true,
      approvedBy: null, // Invisible in standard vector searches until approved!
    });
    await faqCandidate.save();

    return faqCandidate;
  }

  async getAiGeneratedFaqCandidates() {
    return this.faqModel.find({ isGenerated: true, approvedBy: null }).sort({ createdAt: -1 });
  }

  /**
   * Approves a candidate FAQ, making it live and adding it to the Active Vector indexing space.
   */
  async approveFaq(adminId: string, faqId: string) {
    const faq = await this.faqModel.findById(faqId);
    if (!faq) {
      throw new NotFoundException('FAQ candidate not found');
    }

    faq.approvedBy = adminId;
    const saved = await faq.save();

    // Dynamically insert into our VectorStore
    await this.vectorStore.addDocument(saved._id.toString(), saved.embedding, {
      question: saved.question,
      answer: saved.answer,
    });

    // Log the approval action
    const log = new this.moderationLogModel({
      moderatorId: adminId,
      action: 'approve_faq',
      targetId: faqId,
      reason: 'AI FAQ candidate approved for vector space matching',
    });
    await log.save();

    return saved;
  }

  /**
   * Rejects and permanently purges a candidate FAQ.
   */
  async rejectFaq(adminId: string, faqId: string) {
    const faq = await this.faqModel.findOne({ _id: faqId, approvedBy: null });
    if (!faq) {
      throw new NotFoundException('FAQ candidate not found or already active');
    }

    await this.faqModel.deleteOne({ _id: faqId });

    // Log reject action
    const log = new this.moderationLogModel({
      moderatorId: adminId,
      action: 'reject_faq',
      targetId: faqId,
      reason: 'Discarded AI FAQ candidate',
    });
    await log.save();

    return { success: true };
  }

  /**
   * Seeds the database with FAQs from a JSON file.
   * This is a critical feature for populating the initial knowledge base.
   */
  async seedFaqs(adminId: string, faqData: any) {
    if (!faqData || !faqData.entries) {
      throw new BadRequestException('Invalid FAQ data format');
    }

    let count = 0;
    for (const entry of faqData.entries) {
      const existing = await this.faqModel.findOne({ question: entry.question });
      if (!existing) {
        const embedding = await this.aiService.generateEmbeddings(entry.question);
        const newFaq = new this.faqModel({
          question: entry.question,
          answer: entry.answer,
          embedding,
          isGenerated: false,
          approvedBy: adminId,
        });
        const saved = await newFaq.save();
        
        // Also register in VectorStore for immediate availability
        await this.vectorStore.addDocument(saved._id.toString(), embedding, {
          question: saved.question,
          answer: saved.answer,
        });
        
        count++;
      }
    }

    return { seededCount: count };
  }
}
