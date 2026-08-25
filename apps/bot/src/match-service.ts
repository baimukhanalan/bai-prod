import { PrismaClient } from '@prisma/client';
import { enqueueAccepted } from './automation.js';

export async function acceptMatch(prisma: PrismaClient, receiverId: string, matchId: string) {
  return prisma.$transaction(async tx => {
    const changed = await tx.matchRequest.updateMany({ where: { id: matchId, receiverId, status: 'pending' }, data: { status: 'accepted' } });
    if (!changed.count) return null;
    const match = await tx.matchRequest.findUniqueOrThrow({ where: { id: matchId } });
    await enqueueAccepted(tx, match);
    return match;
  });
}

export async function declineMatch(prisma: PrismaClient, receiverId: string, matchId: string) {
  const changed = await prisma.matchRequest.updateMany({ where: { id: matchId, receiverId, status: 'pending' }, data: { status: 'declined' } });
  return changed.count === 1;
}
