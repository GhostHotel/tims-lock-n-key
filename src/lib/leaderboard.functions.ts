import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TECHNICIANS } from "@/lib/match";

export const startRankedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ technician: z.enum(TECHNICIANS), difficulty: z.enum(["easy", "medium", "hard"]), playerCount: z.number().int().min(1).max(4) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("start_ranked_match", { p_technician: data.technician, p_difficulty: data.difficulty, p_player_count: data.playerCount });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
export const finishRankedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ matchId: z.string().uuid(), score: z.number().int().min(0).max(30000), displayName: z.string().trim().min(1).max(24) }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("finish_ranked_match", { p_match_id: data.matchId, p_score: data.score, p_display_name: data.displayName });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });