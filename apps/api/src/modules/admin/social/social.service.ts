import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);
  private readonly twitterToken: string | null;
  private readonly appUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.twitterToken = process.env['TWITTER_ACCESS_TOKEN'] ?? null;
    this.appUrl = process.env['APP_ORIGIN'] ?? 'http://localhost:4200';
    if (!this.twitterToken) {
      this.logger.log(
        'TWITTER_ACCESS_TOKEN not set — using intent URL fallback',
      );
    }
  }

  async getAnnouncement(announcementId: string) {
    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findUnique({
        where: { id: announcementId },
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          content: true,
          status: true,
          createdAt: true,
        },
      }),
    );
    if (!post || post.type !== 'announcement') {
      throw new NotFoundException('Announcement not found');
    }
    return post;
  }

  async getShareIntents(
    announcementId: string,
    customText?: string,
  ): Promise<{
    twitter: { intentUrl: string; apiAvailable: boolean };
    linkedin: { intentUrl: string };
    defaultText: string;
  }> {
    const post = await this.getAnnouncement(announcementId);
    const postUrl = `${this.appUrl}/community/${post.slug}`;
    const title = post.title.slice(0, 100);
    const defaultText = customText ?? `📢 ${title}`;

    const tweetText = (defaultText + ' ' + postUrl).slice(0, 280);
    const twitterIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    const linkedinIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;

    return {
      twitter: {
        intentUrl: twitterIntent,
        apiAvailable: this.twitterToken !== null,
      },
      linkedin: { intentUrl: linkedinIntent },
      defaultText,
    };
  }

  async postToTwitter(
    adminId: string,
    announcementId: string,
    customText?: string,
  ): Promise<{
    posted: boolean;
    intentUrl: string;
    tweetId: string | null;
    mode: 'api' | 'intent';
  }> {
    const post = await this.getAnnouncement(announcementId);
    const postUrl = `${this.appUrl}/community/${post.slug}`;
    const title = post.title.slice(0, 100);
    const defaultText = customText ?? `📢 ${title}`;
    const tweetText = (defaultText + ' ' + postUrl).slice(0, 280);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    if (!this.twitterToken) {
      await this.prisma.withoutTenant((c) =>
        c.announcementShare.create({
          data: {
            announcementId,
            platform: 'twitter',
            status: 'intent_opened',
          },
        }),
      );
      return { posted: false, intentUrl, tweetId: null, mode: 'intent' };
    }

    try {
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.twitterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: tweetText }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Twitter API ${res.status}: ${detail.slice(0, 200)}`);
      }

      const json = (await res.json()) as { data?: { id?: string } };
      const tweetId = json.data?.id ?? null;

      await this.prisma.withoutTenant((c) =>
        c.announcementShare.create({
          data: {
            announcementId,
            platform: 'twitter',
            status: 'posted',
            externalId: tweetId,
          },
        }),
      );

      this.logger.log(`Tweet ${tweetId} posted for announcement ${announcementId}`);
      return { posted: true, intentUrl, tweetId, mode: 'api' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twitter post failed: ${message}`);

      await this.prisma.withoutTenant((c) =>
        c.announcementShare.create({
          data: {
            announcementId,
            platform: 'twitter',
            status: 'failed',
            error: message.slice(0, 500),
          },
        }),
      );

      return { posted: false, intentUrl, tweetId: null, mode: 'api' };
    }
  }

  async getShareHistory(announcementId: string) {
    return this.prisma.withoutTenant((c) =>
      c.announcementShare.findMany({
        where: { announcementId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}