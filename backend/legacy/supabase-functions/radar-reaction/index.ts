import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Reaction = "happy" | "sad";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { edition_id, reaction } = await req.json();
    if (!edition_id || (reaction !== "happy" && reaction !== "sad")) {
      return new Response(JSON.stringify({ error: "edition_id and valid reaction required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("radar_reactions")
      .select("id, reaction")
      .eq("edition_id", edition_id)
      .eq("ip_address", ip)
      .maybeSingle();

    let current: Reaction | null = null;

    if (existing && existing.reaction === reaction) {
      // toggle off: -1
      await supabase.from("radar_reactions").delete().eq("id", existing.id);
      current = null;
      
      const decrField = existing.reaction === "happy" ? "happy_count" : "sad_count";
      await supabase.rpc("increment_radar_count", { 
        row_id: edition_id, 
        field_name: decrField,
        amount: -1
      });
    } else if (existing) {
      // Changed reaction: -1 from old, +1 to new
      const decrField = existing.reaction === "happy" ? "happy_count" : "sad_count";
      const incrField = reaction === "happy" ? "happy_count" : "sad_count";
      
      await supabase.from("radar_reactions").update({ reaction }).eq("id", existing.id);
      current = reaction;

      await supabase.rpc("increment_radar_counts", { 
        row_id: edition_id, 
        incr_field: incrField,
        decr_field: decrField 
      });
    } else {
      // New reaction: +1
      const { error } = await supabase
        .from("radar_reactions")
        .insert({ edition_id, ip_address: ip, reaction });
      if (error) throw error;
      current = reaction;

      const incrField = reaction === "happy" ? "happy_count" : "sad_count";
      await supabase.rpc("increment_radar_count", { 
        row_id: edition_id, 
        field_name: incrField,
        amount: 1
      });
    }

    // Fetch the updated counts to return to the UI
    const { data: updatedEdition } = await supabase
      .from("radar_editions")
      .select("happy_count, sad_count")
      .eq("id", edition_id)
      .single();

    return new Response(
      JSON.stringify({ 
        reaction: current, 
        happy_count: updatedEdition?.happy_count ?? 0, 
        sad_count: updatedEdition?.sad_count ?? 0 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});