import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { edition_id } = await req.json();
    if (!edition_id) {
      return new Response(JSON.stringify({ error: "edition_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get visitor IP from request headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if like exists
    const { data: existingLike } = await supabase
      .from("radar_likes")
      .select("id")
      .eq("edition_id", edition_id)
      .eq("ip_address", ip)
      .maybeSingle();

    if (existingLike) {
      // User is unliking
      const { error: deleteError } = await supabase
        .from("radar_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) throw deleteError;

      // Decrement likes count
      const { data: edition } = await supabase
        .from("radar_editions")
        .select("likes")
        .eq("id", edition_id)
        .single();

      const newLikes = Math.max(0, (edition?.likes ?? 0) - 1);
      await supabase
        .from("radar_editions")
        .update({ likes: newLikes })
        .eq("id", edition_id);

      return new Response(
        JSON.stringify({ liked: false, likes: newLikes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // User is liking
      const { error: insertError } = await supabase
        .from("radar_likes")
        .insert({ edition_id, ip_address: ip });

      if (insertError) throw insertError;

      // Increment likes count
      const { data: edition } = await supabase
        .from("radar_editions")
        .select("likes")
        .eq("id", edition_id)
        .single();

      const newLikes = (edition?.likes ?? 0) + 1;
      await supabase
        .from("radar_editions")
        .update({ likes: newLikes })
        .eq("id", edition_id);

      return new Response(
        JSON.stringify({ liked: true, likes: newLikes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
