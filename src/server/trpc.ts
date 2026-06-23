import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { context, redis, reddit } from '@devvit/web/server';
import { ITEMS } from '../shared/items';

export type Context = object;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const MAX_STEPS = 100;

export type MinionType = 'SKELETON' | 'GOLEM' | 'MAGE';

export interface Minion {
  id: string;
  type: MinionType;
  author: string;
  hp: number;
  attack: number;
  hasBoneArmor?: boolean;
}

const MAGE_KEYWORDS = [
  'fuoco', 'fire', 'fuego', 'feu',
  'magia', 'magic', 'magie',
  'maledizione', 'curse', 'maldición', 'malédiction'
];

export const appRouter = router({
  ping: publicProcedure.query(() => {
    return {
      message: 'pong',
    };
  }),

  // Ottiene lo stato del giocatore (passi residui e upgrades)
  getState: publicProcedure.query(async () => {
    const username = await reddit.getCurrentUsername();
    const userId = username ?? 'anonymous';
    const redisKey = `steps:${userId}`;
    const soulsKey = `souls:${userId}`;
    const depthKey = `depth:${userId}`;
    const maxDepthKey = `maxDepth:${userId}`;
    
    let steps = await redis.get(redisKey);
    let souls = await redis.get(soulsKey);
    const depthStr = await redis.get(depthKey);
    const maxDepthStr = await redis.get(maxDepthKey);
    
    // Inizializza se non esiste
    if (steps === undefined) {
      await redis.set(redisKey, MAX_STEPS.toString());
      steps = MAX_STEPS.toString();
    }
    if (souls === undefined) {
      souls = '0';
    }
    const depth = depthStr ? parseInt(depthStr, 10) : 0;
    const maxDepth = maxDepthStr ? parseInt(maxDepthStr, 10) : 0;

    const upgrades = {
      hp: parseInt(await redis.get(`upgrade:${userId}:hp`) ?? '0', 10),
      attack: parseInt(await redis.get(`upgrade:${userId}:attack`) ?? '0', 10),
      soulCatcher: parseInt(await redis.get(`upgrade:${userId}:soulCatcher`) ?? '0', 10),
      boneArmor: parseInt(await redis.get(`upgrade:${userId}:boneArmor`) ?? '0', 10),
      armySize: parseInt(await redis.get(`upgrade:${userId}:armySize`) ?? '0', 10),
    };

    return {
      username: userId,
      stepsLeft: parseInt(steps, 10),
      maxSteps: MAX_STEPS,
      souls: parseInt(souls, 10),
      depth,
      maxDepth,
      upgrades
    };
  }),

  // Consuma un passo (verrà usato quando ci si muove sulla mappa)
  spendStep: publicProcedure.mutation(async () => {
    const username = await reddit.getCurrentUsername();
    const userId = username ?? 'anonymous';
    const redisKey = `steps:${userId}`;

    const stepsStr = await redis.get(redisKey);
    let steps = stepsStr ? parseInt(stepsStr, 10) : MAX_STEPS;

    if (steps <= 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Non hai più passi per oggi!',
      });
    }

    steps -= 1;
    await redis.set(redisKey, steps.toString());

    return {
      username: userId,
      stepsLeft: steps,
      maxSteps: MAX_STEPS,
    };
  }),

  // Guadagna Anime sconfiggendo i nemici
  gainSouls: publicProcedure
    .input(z.object({ amount: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const soulsKey = `souls:${userId}`;

      // Calcola bonus dal Soul Catcher (+50% per livello)
      const soulCatcherLevelStr = await redis.get(`upgrade:${userId}:soulCatcher`);
      const soulCatcherLevel = soulCatcherLevelStr ? parseInt(soulCatcherLevelStr, 10) : 0;
      
      const multiplier = 1 + (0.5 * soulCatcherLevel);
      const finalAmount = Math.floor(input.amount * multiplier);

      const soulsStr = await redis.get(soulsKey);
      let souls = soulsStr ? parseInt(soulsStr, 10) : 0;
      
      souls += finalAmount;
      await redis.set(soulsKey, souls.toString());

      return { souls, added: finalAmount };
  }),

  // Incrementa la depth quando il giocatore vince un nodo battaglia
  winBattle: publicProcedure.mutation(async () => {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const depthKey = `depth:${userId}`;
      const maxDepthKey = `maxDepth:${userId}`;

      const depthStr = await redis.get(depthKey);
      let depth = depthStr ? parseInt(depthStr, 10) : 0;
      depth += 1;

      await redis.set(depthKey, depth.toString());

      const maxDepthStr = await redis.get(maxDepthKey);
      let maxDepth = maxDepthStr ? parseInt(maxDepthStr, 10) : 0;

      if (depth > maxDepth) {
          maxDepth = depth;
          await redis.set(maxDepthKey, maxDepth.toString());
          // Aggiorna Leaderboard globale
          await redis.zAdd('leaderboard', { member: userId, score: maxDepth });
      }

      return { depth, maxDepth };
  }),

  // Resetta progressione quando il giocatore muore
  die: publicProcedure.mutation(async () => {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const depthKey = `depth:${userId}`;
      const soulsKey = `souls:${userId}`;

      // Reset depth e souls
      await redis.set(depthKey, '0');
      await redis.set(soulsKey, '0');

      // Reset upgrades
      await redis.set(`upgrade:${userId}:hp`, '0');
      await redis.set(`upgrade:${userId}:attack`, '0');
      await redis.set(`upgrade:${userId}:soulCatcher`, '0');
      await redis.set(`upgrade:${userId}:boneArmor`, '0');
      await redis.set(`upgrade:${userId}:armySize`, '0');

      return { success: true, depth: 0 };
  }),

  // Ottieni la top 10 della leaderboard
  getLeaderboard: publicProcedure.query(async () => {
      try {
          const topPlayers = await redis.zRange('leaderboard', 0, 9, { by: 'rank', reverse: true });
          // zRange in devvit restituisce un array di { member, score }
          return topPlayers.map((entry: { member: string; score: number }) => ({
              username: entry.member,
              score: entry.score
          }));
      } catch (e) {
          console.error("Error fetching leaderboard", e);
          return [];
      }
  }),

  // Compra un oggetto nello Shop
  buyUpgrade: publicProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input }) => {
      const item = ITEMS.find(i => i.id === input.itemId);
      if (!item) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Oggetto non valido',
        });
      }

      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      const soulsKey = `souls:${userId}`;
      const upgradeKey = `upgrade:${userId}:${item.effectType}`;

      const soulsStr = await redis.get(soulsKey);
      let souls = soulsStr ? parseInt(soulsStr, 10) : 0;

      if (souls < item.cost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Non hai abbastanza Anime! Te ne servono ${item.cost}.`,
        });
      }

      souls -= item.cost;
      await redis.set(soulsKey, souls.toString());

      const currentUpgradeStr = await redis.get(upgradeKey);
      let currentUpgrade = currentUpgradeStr ? parseInt(currentUpgradeStr, 10) : 0;
      currentUpgrade += item.effectValue;
      await redis.set(upgradeKey, currentUpgrade.toString());

      return { success: true, souls, currentUpgrade };
  }),

  // Legge i commenti dal post e li trasforma in Minions
  getMinions: publicProcedure.query(async () => {
    const postId = context.postId;
    
    if (!postId) {
      // Per l'ambiente locale/preview potrebbe mancare il postId, 
      // restituiamo un set di minion di default per test.
      return [
        { id: '1', type: 'SKELETON', author: 'Dummy1', hp: 10, attack: 2 },
        { id: '2', type: 'GOLEM', author: 'Dummy2', hp: 30, attack: 5 }
      ] as Minion[];
    }

    try {
      const username = await reddit.getCurrentUsername();
      const userId = username ?? 'anonymous';
      
      // Carica i potenziamenti del giocatore
      const hpBonusStr = await redis.get(`upgrade:${userId}:hp`);
      const attackBonusStr = await redis.get(`upgrade:${userId}:attack`);
      const hpBonus = hpBonusStr ? parseInt(hpBonusStr, 10) : 0;
      const attackBonus = attackBonusStr ? parseInt(attackBonusStr, 10) : 0;
      const boneArmorLevel = parseInt(await redis.get(`upgrade:${userId}:boneArmor`) ?? '0', 10);

      const commentsResponse = await reddit.getComments({
        postId: postId,
        limit: 15,
      });
      
      const comments = await commentsResponse.all();
      const minions: Minion[] = [];

      for (const comment of comments) {
        const text = comment.body ?? '';
        const lowerText = text.toLowerCase();
        const author = comment.authorName ?? 'unknown';
        const words = text.split(' ').length;
        const score = comment.score ?? 0;
        
        // Calcola bonus da Upvotes (se score è positivo)
        const scoreBonusHP = Math.max(0, score * 2);
        const scoreBonusATK = Math.max(0, score * 1);
        
        let type: MinionType = 'SKELETON';
        let hp = 10;
        let attack = 2;
        let hasBoneArmor = false;

        const isMage = MAGE_KEYWORDS.some(kw => lowerText.includes(kw));

        if (words > 40) {
          type = 'GOLEM';
          hp = 30;
          attack = 5;
          if (boneArmorLevel > 0) hasBoneArmor = true;
        } else if (isMage) {
          type = 'MAGE';
          hp = 8;
          attack = 6;
        } else {
          // Standard skeleton
          type = 'SKELETON';
          hp = 10;
          attack = 2;
        }

        minions.push({
          id: comment.id,
          type,
          author,
          hp: hp + (hpBonus * 5) + scoreBonusHP,       // Base + Upgrades + Upvotes
          attack: attack + attackBonus + scoreBonusATK, // Base + Upgrades + Upvotes
          hasBoneArmor,
        });
      }

      // Se non ci sono commenti, dai un paio di minion gratuiti
      if (minions.length === 0) {
        minions.push({ id: 'free1', type: 'SKELETON', author: 'System', hp: 10, attack: 2 });
      }

      return minions;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [
        { id: 'fallback1', type: 'SKELETON', author: 'Fallback', hp: 10, attack: 2 }
      ] as Minion[];
    }
  }),
});

export type AppRouter = typeof appRouter;
