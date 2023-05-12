import { z } from 'zod';

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure
} from 'y/server/api/trpc';
import { clerkClient } from '@clerk/nextjs/server';
import { TRPCError } from '@trpc/server';

import { Ratelimit } from '@upstash/ratelimit'; // for deno: see above
import { Redis } from '@upstash/redis';
import { filterUserForClient } from 'y/server/helpers/filterUserForClient';

// Create a new ratelimiter, that allows 3 requests per 1 minute
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  analytics: true,
  /**
   * Optional prefix for the keys used in redis. This is useful if you want to share a redis
   * instance with other applications and want to avoid key collisions. The default prefix is
   * "@upstash/ratelimit"
   */
  prefix: '@upstash/ratelimit'
});

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({
      take: 100,
      orderBy: [{ createdAt: 'desc' }]
    });

    const users = (
      await clerkClient.users.getUserList({
        userId: posts.map((post) => post.authorId),
        limit: 100
      })
    ).map(filterUserForClient);

    return posts.map((post) => {
      const author = users.find((user) => post.authorId === user.id);

      if (!author || !author.username)
        throw new TRPCError({
          message: 'Author not found for post',
          code: 'INTERNAL_SERVER_ERROR'
        });

      return {
        post,
        author: {
          ...author,
          username: author.username
        }
      };
    });
  }),

  create: privateProcedure
    .input(
      z.object({
        content: z.string().emoji('Only emojies are allowed').min(1).max(280)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.userId;

      const { success } = await ratelimit.limit(authorId);
      if (!success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS'
        });
      }

      const post = await ctx.prisma.post.create({
        data: {
          authorId,
          content: input.content
        }
      });

      return post;
    })
});
