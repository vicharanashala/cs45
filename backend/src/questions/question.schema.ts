import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema({ timestamps: true })
export class Question {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, enum: ['generic', 'personal'], default: 'generic' })
  type: 'generic' | 'personal';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: string;

  @Prop({ type: [Number], required: false })
  embedding: number[];

  @Prop({ default: false })
  isModerated: boolean;

  @Prop({ required: true, enum: ['approved', 'pending', 'rejected'], default: 'approved' })
  moderationStatus: 'approved' | 'pending' | 'rejected';

  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  answerCount: number;

  @Prop({ default: false })
  isClosed: boolean;

  @Prop({ default: false })
  adminReviewRequested: boolean;

  @Prop({ default: 0 })
  adminReviewBetSp: number;

  @Prop({ default: 0 })
  adminReviewPriority: number;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ title: 'text', content: 'text' });
