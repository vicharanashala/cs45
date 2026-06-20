import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('admin', 'moderator')
  @Get('analytics')
  @ApiOperation({ summary: '[Admin/Moderator] Get platform analytics dashboard data' })
  @ApiResponse({ status: 200, description: 'Returns counts of users, FAQs, questions, feedback satisfaction, etc.' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin or moderator role.' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Roles('admin')
  @Get('users')
  @ApiOperation({ summary: '[Admin] Get list of all registered users' })
  @ApiResponse({ status: 200, description: 'Returns array of all users (passwords excluded).' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role.' })
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  @Roles('admin')
  @Patch('users/:id/ban')
  @ApiOperation({ summary: '[Admin] Ban or unban a user account' })
  @ApiParam({ name: 'id', description: 'User ID to ban/unban' })
  @ApiBody({ schema: { example: { reason: 'Repeated policy violations' } } })
  @ApiResponse({ status: 200, description: 'Returns updated ban status and user info.' })
  @ApiResponse({ status: 400, description: 'Cannot ban yourself.' })
  async toggleBan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.toggleUserBan(req.user._id, id, body.reason || '');
  }

  @Roles('admin', 'moderator')
  @Get('moderation/personal')
  @ApiOperation({ summary: '[Admin/Moderator] Get all personal/private user queries awaiting review' })
  @ApiResponse({ status: 200, description: 'Returns list of personal queries sorted by date.' })
  async getPersonalQueries() {
    return this.adminService.getPersonalQueries();
  }

  @Roles('admin', 'moderator')
  @Post('moderation/personal/:id/review')
  @ApiOperation({ summary: '[Admin/Moderator] Respond to and resolve a personal query' })
  @ApiParam({ name: 'id', description: 'Personal query ID to review' })
  @ApiBody({ schema: { example: { answerContent: 'We have investigated your issue and...', isValid: true } } })
  @ApiResponse({ status: 200, description: 'Query resolved. User notified via notification.' })
  async reviewPersonal(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { answerContent: string; isValid?: boolean },
  ) {
    return this.adminService.reviewPersonalQuery(req.user._id, id, body);
  }

  @Roles('admin', 'moderator')
  @Post('summarize/:discussionId')
  @ApiOperation({ summary: '[Admin/Moderator] AI-generate an FAQ candidate from a community discussion thread' })
  @ApiParam({ name: 'discussionId', description: 'Question/discussion ID to summarize into an FAQ' })
  @ApiResponse({ status: 201, description: 'FAQ candidate created. Pending admin approval.' })
  @ApiResponse({ status: 400, description: 'Discussion has no answers yet.' })
  async summarizeDiscussion(
    @Req() req: any,
    @Param('discussionId') id: string,
  ) {
    return this.adminService.generateFaqFromDiscussion(req.user._id, id);
  }

  @Roles('admin', 'moderator')
  @Get('moderation/ai-faqs')
  @ApiOperation({ summary: '[Admin/Moderator] Get all AI-generated FAQ candidates pending approval' })
  @ApiResponse({ status: 200, description: 'Returns list of unreviewed AI-generated FAQ candidates.' })
  async getGeneratedCandidates() {
    return this.adminService.getAiGeneratedFaqCandidates();
  }

  @Roles('admin', 'moderator')
  @Post('moderation/ai-faqs/:id/approve')
  @ApiOperation({ summary: '[Admin/Moderator] Approve an AI-generated FAQ candidate and publish it' })
  @ApiParam({ name: 'id', description: 'FAQ candidate ID to approve' })
  @ApiResponse({ status: 200, description: 'FAQ approved and added to vector search index.' })
  async approveFaq(@Req() req: any, @Param('id') id: string) {
    return this.adminService.approveFaq(req.user._id, id);
  }

  @Roles('admin', 'moderator')
  @Delete('moderation/ai-faqs/:id')
  @ApiOperation({ summary: '[Admin/Moderator] Reject and permanently delete an AI-generated FAQ candidate' })
  @ApiParam({ name: 'id', description: 'FAQ candidate ID to reject' })
  @ApiResponse({ status: 200, description: 'FAQ candidate deleted.' })
  async rejectFaq(@Req() req: any, @Param('id') id: string) {
    return this.adminService.rejectFaq(req.user._id, id);
  }

  @Roles('admin')
  @Post('seed-faqs')
  @ApiOperation({ summary: '[Admin] Seed FAQs from the default JSON file' })
  @ApiResponse({ status: 201, description: 'FAQs seeded successfully.' })
  async seedFaqs(@Req() req: any) {
    // Read the file from the root directory
    const fs = require('fs');
    const path = require('path');
    const faqPath = path.resolve(__dirname, '../../../vicharanashala_faq.json');
    
    if (!fs.existsSync(faqPath)) {
      throw new BadRequestException('Seed file not found at ' + faqPath);
    }

    const faqData = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
    return this.adminService.seedFaqs(req.user._id, faqData);
  }
}
