CREATE TABLE public.match_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 technician text NOT NULL CHECK (technician IN ('Matt','Taylor','Slade','RJ','Opy','Kevin')),
 difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
 player_count integer NOT NULL CHECK (player_count BETWEEN 1 AND 4),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 score integer CHECK (score BETWEEN 0 AND 30000)
);
GRANT SELECT ON public.match_sessions TO authenticated;
GRANT ALL ON public.match_sessions TO service_role;
ALTER TABLE public.match_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own matches" ON public.match_sessions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX match_sessions_user_started ON public.match_sessions(user_id, started_at DESC);
CREATE TABLE public.leaderboard_scores (
 user_id uuid PRIMARY KEY,
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 24),
 technician text NOT NULL CHECK (technician IN ('Matt','Taylor','Slade','RJ','Opy','Kevin')),
 difficulty text NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
 score integer NOT NULL CHECK (score BETWEEN 0 AND 30000),
 achieved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leaderboard_scores TO anon, authenticated;
GRANT ALL ON public.leaderboard_scores TO service_role;
ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public high scores" ON public.leaderboard_scores FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX leaderboard_top_scores ON public.leaderboard_scores(score DESC, achieved_at ASC);
CREATE FUNCTION public.start_ranked_match(p_technician text, p_difficulty text, p_player_count integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to rank your match'; END IF;
 IF EXISTS (SELECT 1 FROM public.match_sessions WHERE user_id=auth.uid() AND started_at > now()-interval '10 seconds') THEN RAISE EXCEPTION 'Please wait before starting another match'; END IF;
 INSERT INTO public.match_sessions(user_id,technician,difficulty,player_count) VALUES(auth.uid(),p_technician,p_difficulty,p_player_count) RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.start_ranked_match(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ranked_match(text,text,integer) TO authenticated;
CREATE FUNCTION public.finish_ranked_match(p_match_id uuid, p_score integer, p_display_name text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.match_sessions; best integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to submit your score'; END IF;
 IF p_score IS NULL OR p_score < 0 OR p_score > 30000 OR p_display_name IS NULL OR char_length(trim(p_display_name)) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Invalid score or player name'; END IF;
 SELECT * INTO m FROM public.match_sessions WHERE id=p_match_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.finished_at IS NULL THEN
  IF now() < m.started_at + interval '600 seconds' THEN RAISE EXCEPTION 'Match is not complete'; END IF;
  IF now() > m.started_at + interval '2 hours' THEN RAISE EXCEPTION 'Match has expired'; END IF;
  UPDATE public.match_sessions SET finished_at=now(),score=p_score WHERE id=m.id;
  INSERT INTO public.leaderboard_scores(user_id,display_name,technician,difficulty,score) VALUES(auth.uid(),trim(p_display_name),m.technician,m.difficulty,p_score)
  ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,technician=EXCLUDED.technician,difficulty=EXCLUDED.difficulty,score=EXCLUDED.score,achieved_at=now() WHERE EXCLUDED.score>public.leaderboard_scores.score;
 END IF;
 SELECT score INTO best FROM public.leaderboard_scores WHERE user_id=auth.uid();
 RETURN best;
END; $$;
REVOKE ALL ON FUNCTION public.finish_ranked_match(uuid,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_ranked_match(uuid,integer,text) TO authenticated;