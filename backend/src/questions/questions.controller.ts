import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Questions')
@Controller('api/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get community questions list' })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'upvoted', 'unanswered'], description: 'Sort order (default: recent)' })
  @ApiResponse({ status: 200, description: 'Returns list of community questions.' })
  async getQuestions(
    @Query('sort') sort?: 'recent' | 'upvoted' | 'unanswered',
  ) {
    return this.questionsService.getCommunityQuestions(sort || 'recent');
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('votes')
  @ApiOperation({ summary: 'Get all votes cast by the logged-in user' })
  @ApiResponse({ status: 200, description: 'Returns map of question/answer IDs to vote values.' })
  async getUserVotes(@Req() req: any) {
    return this.questionsService.getUserVotes(req.user._id);
  }

  @Get('clusters')
  @ApiOperation({ summary: 'Get community questions grouped into similarity clusters' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Similarity threshold (default: 0.7)' })
  @ApiResponse({ status: 200, description: 'Returns array of question clusters.' })
  async getClusters(@Query('threshold') threshold?: number) {
    return this.questionsService.getQuestionClusters(threshold || 0.7);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full details of a specific question including its answers' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Optional userId to include user-specific data (bookmarks, votes)' })
  @ApiResponse({ status: 200, description: 'Returns question details with answers.' })
  @ApiResponse({ status: 404, description: 'Question not found.' })
  async getDetails(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.questionsService.getQuestionDetails(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('analyze-toxicity')
  @ApiOperation({ summary: 'Pre-check text for toxicity' })
  @ApiBody({ schema: { example: { text: 'Some text to check' } } })
  @ApiResponse({ status: 200, description: 'Returns { isToxic: boolean, reason?: string }' })
  async analyzeToxicity(@Body() body: { text: string }) {
    return this.questionsService.analyzeToxicity(body.text);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Post a new question to the community' })
  @ApiBody({ schema: { example: { title: 'How do I reset my password?', content: 'I forgot my password and cannot log in.' } } })
  @ApiResponse({ status: 201, description: 'Question posted. Returns the created question object.' })
  async raiseQuery(
    @Req() req: any,
    @Body() body: { title: string; content: string; adminReviewRequested?: boolean; adminReviewBetSp?: number },
  ) {
    return this.questionsService.raiseQuery(req.user._id, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/answers')
  @ApiOperation({ summary: 'Submit an answer to a question' })
  @ApiParam({ name: 'id', description: 'Question ID to answer' })
  @ApiBody({ schema: { example: { content: 'You can reset your password by clicking the forgot password link.' } } })
  @ApiResponse({ status: 201, description: 'Answer submitted successfully.' })
  async submitAnswer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.questionsService.submitAnswer(req.user._id, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/vote')
  @ApiOperation({ summary: 'Upvote or downvote a question' })
  @ApiParam({ name: 'id', description: 'Question ID to vote on' })
  @ApiBody({ schema: { example: { value: 1 }, description: 'value: 1 for upvote, -1 for downvote' } })
  @ApiResponse({ status: 200, description: 'Vote recorded.' })
  async voteQuestion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { value: number },
  ) {
    return this.questionsService.voteQuestion(req.user._id, id, body.value);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('answers/:answerId/vote')
  @ApiOperation({ summary: 'Upvote or downvote an answer' })
  @ApiParam({ name: 'answerId', description: 'Answer ID to vote on' })
  @ApiBody({ schema: { example: { value: 1 }, description: 'value: 1 for upvote, -1 for downvote' } })
  @ApiResponse({ status: 200, description: 'Vote recorded.' })
  async voteAnswer(
    @Req() req: any,
    @Param('answerId') answerId: string,
    @Body() body: { value: number },
  ) {
    return this.questionsService.voteAnswer(req.user._id, answerId, body.value);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('answers/:answerId/accept')
  @ApiOperation({ summary: 'Accept an answer as the correct solution (question author only)' })
  @ApiParam({ name: 'answerId', description: 'Answer ID to accept' })
  @ApiResponse({ status: 200, description: 'Answer marked as accepted.' })
  @ApiResponse({ status: 403, description: 'Only the question author can accept an answer.' })
  async acceptAnswer(@Req() req: any, @Param('answerId') answerId: string) {
    return this.questionsService.acceptAnswer(req.user._id, answerId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark on a question (add or remove)' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Bookmark toggled.' })
  async toggleBookmark(@Req() req: any, @Param('id') id: string) {
    return this.questionsService.toggleBookmark(req.user._id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get(':id/is-bookmarked')
  @ApiOperation({ summary: 'Check if the logged-in user has bookmarked a specific question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Returns { bookmarked: boolean }' })
  async checkBookmark(@Req() req: any, @Param('id') id: string) {
    const isBookmarked = await this.questionsService.isBookmarked(req.user._id, id);
    return { bookmarked: isBookmarked };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a query' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Query deleted.' })
  async deleteQuery(@Req() req: any, @Param('id') id: string) {
    return this.questionsService.deleteQuery(req.user._id, id);
  }
}
