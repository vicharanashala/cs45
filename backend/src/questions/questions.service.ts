import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuestionDocument } from './question.schema';
import { AnswerDocument } from './answer.schema';
import { VoteDocument } from './vote.schema';
import { BookmarkDocument } from './bookmark.schema';
import { UserDocument } from '../users/user.schema';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel('Question') private readonly questionModel: Model<QuestionDocument>,
    @InjectModel('Answer') private readonly answerModel: Model<AnswerDocument>,
    @InjectModel('Vote') private readonly voteModel: Model<VoteDocument>,
    @InjectModel('Bookmark') private readonly bookmarkModel: Model<BookmarkDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Fetches community questions with customizable sorting (recent, upvoted, unanswered).
   * Automatically screens out private personal queries and blocked content.
   */
  async getCommunityQuestions(sort: 'recent' | 'upvoted' | 'unanswered' = 'recent') {
    const query: any = {
      type: 'generic',
      moderationStatus: 'approved',
    };

    let sortQuery: any = { createdAt: -1 };

    if (sort === 'upvoted') {
      sortQuery = { upvotes: -1, createdAt: -1 };
    }

    let questions = await this.questionModel
      .find(query)
      .populate('author', 'name reputationPoints')
      .sort(sortQuery);

    if (sort === 'unanswered') {
      // Filter questions with answerCount === 0
      questions = questions.filter((q) => q.answerCount === 0);
    }

    const questionIds = questions.map((q) => q._id.toString());
    const answers = questionIds.length
      ? await this.answerModel
          .find({ questionId: { $in: questionIds } })
          .populate('author', 'name reputationPoints role')
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
              upvotes: latestAnswer.upvotes,
              createdAt: latestAnswer.createdAt,
              author: latestAnswer.author,
            }
          : null,
      };
    });
  }

  async getQuestionDetails(questionId: string, userId?: string) {
    const question = await this.questionModel
      .findById(questionId)
      .populate('author', 'name reputationPoints role');

    if (!question) {
      throw new NotFoundException('Discussion question not found');
    }

    // Access control for personal queries: only accessible to author, moderator, or admin
    if (question.type === 'personal') {
      if (!userId) {
        throw new ForbiddenException('Access denied to private query');
      }
      const user = await this.userModel.findById(userId);
      if (
        (question.author as any)._id.toString() !== userId &&
        user.role !== 'admin' &&
        user.role !== 'moderator'
      ) {
        throw new ForbiddenException('Access denied to private query');
      }
    }

    const answers = await this.answerModel
      .find({ questionId, isModerated: false })
      .populate('author', 'name reputationPoints role')
      .sort({ isAccepted: -1, upvotes: -1, createdAt: 1 });

    return {
      question,
      answers,
    };
  }

  /**
   * Raises a new query. Core workflow includes:
   * 1. Toxicity screen: immediately blocks offensive inputs.
   * 2. Semantic query classification: flags personal billing/sensitive requests as 'personal', routing them away from public feed.
   * 3. Generic submission: posts immediately and awards +5 SP reputation points.
   */
  async analyzeToxicity(text: string) {
    return this.aiService.analyzeToxicity(text);
  }

  async raiseQuery(
    userId: string,
    questionDto: { title: string; content: string; adminReviewRequested?: boolean; adminReviewBetSp?: number },
  ) {
    const title = questionDto.title.trim();
    const content = questionDto.content.trim();

    // 1. Check for toxicity
    const toxicTitle = await this.aiService.analyzeToxicity(title);
    if (toxicTitle.isToxic) {
      throw new BadRequestException(toxicTitle.reason);
    }
    const toxicContent = await this.aiService.analyzeToxicity(content);
    if (toxicContent.isToxic) {
      throw new BadRequestException(toxicContent.reason);
    }

    // 2. Query classification (generic vs. personal)
    const classification = await this.aiService.classifyQuery(`${title} ${content}`);
    const isPersonal = classification.type === 'personal' || questionDto.adminReviewRequested;

    // 3. Handle SP Betting Escrow
    if (questionDto.adminReviewRequested && questionDto.adminReviewBetSp > 0) {
      const user = await this.userModel.findById(userId);
      if (!user || user.reputationPoints < questionDto.adminReviewBetSp) {
        throw new BadRequestException('Insufficient SP points for this bet.');
      }
      user.reputationPoints -= questionDto.adminReviewBetSp;
      await user.save();
    }

    const embedding = await this.aiService.generateEmbeddings(title);

    const question = new this.questionModel({
      title,
      content,
      type: isPersonal ? 'personal' : 'generic',
      author: userId,
      embedding,
      moderationStatus: isPersonal ? 'pending' : 'approved',
      isClosed: false,
      adminReviewRequested: questionDto.adminReviewRequested || false,
      adminReviewBetSp: questionDto.adminReviewBetSp || 0,
    });

    const saved = await question.save();

    if (!isPersonal) {
      // Award 5 SP reputation points for a constructive question
      await this.usersService.awardReputationPoints(
        userId,
        5,
        'Question Contribution',
        'You earned points for raising a new community discussion',
      );
    }

    return {
      question: saved,
      classification,
      message: isPersonal
        ? 'Your query contains personal or sensitive references. It has been routed securely to our admin team for private resolution.'
        : 'Your question has been posted to the public community discussion feed.',
    };
  }

  /**
   * Appends an answer to a question.
   * Checks toxicity, increments counts, awards +10 SP for contribution, and notifies question owner.
   */
  async submitAnswer(
    userId: string,
    questionId: string,
    answerDto: { content: string },
  ) {
    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundException('Question discussion not found');
    }

    if (question.isClosed) {
      throw new BadRequestException('This discussion has been closed');
    }

    const content = answerDto.content.trim();

    // Toxicity check
    const toxicity = await this.aiService.analyzeToxicity(content);
    if (toxicity.isToxic) {
      throw new BadRequestException(toxicity.reason);
    }

    const answer = new this.answerModel({
      questionId,
      author: userId,
      content,
      isAccepted: false,
      isModerated: false,
    });

    const saved = await answer.save();

    // Increment question answer count
    await this.questionModel.findByIdAndUpdate(questionId, { $inc: { answerCount: 1 } });

    // Award +10 SP points for answering
    await this.usersService.awardReputationPoints(
      userId,
      10,
      'Answer Contribution',
      'You earned reputation points for providing a helpful answer',
    );

    // Notify question author
    if (question.author.toString() !== userId) {
      await this.usersService.awardReputationPoints(
        question.author.toString(),
        0, // Zero points, just triggering a notification
        'New Discussion Response',
        `A member answered your question: "${question.title.substring(0, 30)}..."`,
      );
    }

    return saved;
  }

  /**
   * Casts upvote/downvote on a question. Prevents double-voting.
   */
  async voteQuestion(userId: string, questionId: string, value: number) {
    if (value !== 1 && value !== -1) {
      throw new BadRequestException('Invalid vote value');
    }

    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const existingVote = await this.voteModel.findOne({
      userId,
      targetId: questionId,
      targetType: 'question',
    });

    let netChange = 0;

    if (existingVote) {
      if (existingVote.value === value) {
        // Retract vote
        await this.voteModel.deleteOne({ _id: existingVote._id });
        netChange = -value;
      } else {
        // Change vote direction
        existingVote.value = value;
        await existingVote.save();
        netChange = 2 * value;
      }
    } else {
      // New vote
      const newVote = new this.voteModel({
        userId,
        targetId: questionId,
        targetType: 'question',
        value,
      });
      await newVote.save();
      netChange = value;
    }

    question.upvotes += netChange;
    await question.save();

    return { upvotes: question.upvotes };
  }

  /**
   * Casts upvote/downvote on an answer.
   * Modifies answer score and awards/deducts reputation points from answer author (+5 SP per net upvote).
   */
  async voteAnswer(userId: string, answerId: string, value: number) {
    if (value !== 1 && value !== -1) {
      throw new BadRequestException('Invalid vote value');
    }

    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    const existingVote = await this.voteModel.findOne({
      userId,
      targetId: answerId,
      targetType: 'answer',
    });

    let netChange = 0;

    if (existingVote) {
      if (existingVote.value === value) {
        // Retract vote
        await this.voteModel.deleteOne({ _id: existingVote._id });
        netChange = -value;
      } else {
        // Change vote direction
        existingVote.value = value;
        await existingVote.save();
        netChange = 2 * value;
      }
    } else {
      // New vote
      const newVote = new this.voteModel({
        userId,
        targetId: answerId,
        targetType: 'answer',
        value,
      });
      await newVote.save();
      netChange = value;
    }

    answer.upvotes += netChange;
    await answer.save();

    // Reward answer author +5 SP points per upvote, or penalize -5 SP per downvote
    if (answer.author.toString() !== userId) {
      const repChange = netChange * 5;
      await this.usersService.awardReputationPoints(
        answer.author.toString(),
        repChange,
        repChange > 0 ? 'Answer Upvoted' : 'Answer Downvoted',
        repChange > 0
          ? 'Your answer received a community upvote'
          : 'Your answer received a community downvote',
      );
    }

    return { upvotes: answer.upvotes };
  }

  /**
   * Accepts an answer. Only allowed by question author.
   * Awards +30 SP reputation points to the provider of the accepted answer.
   */
  async acceptAnswer(userId: string, answerId: string) {
    const answer = await this.answerModel.findById(answerId);
    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    const question = await this.questionModel.findById(answer.questionId);
    if (!question) {
      throw new NotFoundException('Question discussion not found');
    }

    if (question.author.toString() !== userId.toString()) {
      throw new ForbiddenException('Only the question author can accept answers');
    }

    // Reset other answers as not accepted
    await this.answerModel.updateMany(
      { questionId: question._id },
      { $set: { isAccepted: false } },
    );

    answer.isAccepted = true;
    await answer.save();

    // Mark question as closed/resolved
    question.isClosed = true;
    await question.save();

    // Award +30 SP points to answer contributor
    await this.usersService.awardReputationPoints(
      answer.author.toString(),
      30,
      'Accepted Answer Bonus',
      'Your answer was chosen as the accepted solution!',
    );

    return answer;
  }

  /**
   * Bookmarks or unbookmarks a discussion question.
   */
  async toggleBookmark(userId: string, questionId: string) {
    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const existing = await this.bookmarkModel.findOne({
      userId,
      itemId: questionId,
      itemType: 'question',
    });

    if (existing) {
      await this.bookmarkModel.deleteOne({ _id: existing._id });
      return { bookmarked: false };
    } else {
      const newBookmark = new this.bookmarkModel({
        userId,
        itemId: questionId,
        itemType: 'question',
      });
      await newBookmark.save();

      // Award +2 SP reputation to the author when someone bookmarks their question
      if (question.author.toString() !== userId) {
        await this.usersService.awardReputationPoints(
          question.author.toString(),
          2,
          'Question Bookmarked',
          'A community member saved your question as reference',
        );
      }

      return { bookmarked: true };
    }
  }

  async isBookmarked(userId: string, questionId: string): Promise<boolean> {
    const b = await this.bookmarkModel.findOne({
      userId,
      itemId: questionId,
      itemType: 'question',
    });
    return !!b;
  }

  async getUserVotes(userId: string) {
    const votes = await this.voteModel.find({ userId });
    return votes.reduce((acc, vote) => {
      acc[vote.targetId.toString()] = vote.value;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Question Clustering Feature: Groups similar community discussions to organize the view.
   * This identifies patterns and reduces redundancy in the community feed.
   */
  async getQuestionClusters(threshold: number = 0.7) {
    const questions = await this.questionModel.find({
      type: 'generic',
      moderationStatus: 'approved',
    }).select('title content embedding upvotes answerCount author createdAt')
      .populate('author', 'name');

    if (questions.length === 0) return [];

    const clusters: any[] = [];
    const processedIds = new Set<string>();

    for (const q of questions) {
      if (processedIds.has(q._id.toString())) continue;

      const currentCluster = {
        headline: q.title,
        questions: [q],
        totalUpvotes: q.upvotes || 0,
        totalAnswers: q.answerCount || 0,
      };

      processedIds.add(q._id.toString());

      for (const other of questions) {
        if (processedIds.has(other._id.toString())) continue;

        const similarity = this.calculateCosineSimilarity(
          (q as any).embedding,
          (other as any).embedding
        );

        if (similarity >= threshold) {
          currentCluster.questions.push(other);
          currentCluster.totalUpvotes += (other.upvotes || 0);
          currentCluster.totalAnswers += (other.answerCount || 0);
          processedIds.add(other._id.toString());
        }
      }

      // Sort questions in cluster by upvotes
      currentCluster.questions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      // Use the most upvoted question as the headline
      currentCluster.headline = currentCluster.questions[0].title;

      clusters.push(currentCluster);
    }

    // Sort clusters by total activity (upvotes + answers)
    return clusters.sort((a, b) => (b.totalUpvotes + b.totalAnswers) - (a.totalUpvotes + a.totalAnswers));
  }

  private calculateCosineSimilarity(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || v1.length !== v2.length || v1.length === 0) return 0;
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async deleteQuery(userId: string, questionId: string) {
    const question = await this.questionModel.findById(questionId);
    if (!question) throw new NotFoundException('Question not found');
    
    // Check ownership
    if (question.author.toString() !== userId.toString()) {
       const user = await this.userModel.findById(userId);
       if (!user || user.role !== 'admin') {
         throw new ForbiddenException('You can only delete your own queries');
       }
    }
    
    // Refund escrow if deleted while pending
    if (question.adminReviewRequested && question.moderationStatus === 'pending') {
       const user = await this.userModel.findById(question.author);
       if (user) {
         user.reputationPoints += (question.adminReviewBetSp || 0);
         await user.save();
       }
    }
    
    await this.questionModel.deleteOne({ _id: questionId });
    await this.answerModel.deleteMany({ questionId });
    await this.bookmarkModel.deleteMany({ itemId: questionId });
    return { success: true };
  }
}
