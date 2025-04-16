import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createAnnotation(data: {
  text: string;
  explanation: string;
  translation?: string;
  url: string;
  userId: string;
}) {
  return prisma.annotation.create({
    data,
  });
}

export async function getUserAnnotations(userId: string) {
  return prisma.annotation.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getAnnotationsByUrl(userId: string, url: string) {
  return prisma.annotation.findMany({
    where: {
      userId,
      url,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export default prisma;
