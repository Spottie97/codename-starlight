/**
 * Database client initialization
 * Separated from server.ts to avoid circular dependencies
 */

import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
export const prisma = new PrismaClient();


