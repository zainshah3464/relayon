import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const POST_TYPES = ['discussion', 'template', 'article'] as const;
export type PostType = (typeof POST_TYPES)[number];

export class CreatePostDto {
  @IsString()
  @IsIn(POST_TYPES)
  type!: PostType;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(50_000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateReplyDto {
  @IsUUID()
  postId!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10_000)
  content!: string;
}

export class ListPostsQuery {
  @IsOptional()
  @IsIn(['discussion', 'template', 'article', 'announcement'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @IsOptional()
  @IsIn(['recent', 'popular', 'top'])
  sort?: 'recent' | 'popular' | 'top';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class FlagDto {
  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  replyId?: string;

  @IsIn(['spam', 'abuse', 'off-topic', 'other'])
  reason!: 'spam' | 'abuse' | 'off-topic' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;
}

export class ToggleLikeDto {
  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  replyId?: string;
}