import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

describe.skipIf(!url || !key)("deployed analysis quota", () => {
  it("reserves five distinct free trials atomically and releases failed analyses", async () => {
    if (!url || !key) throw new Error("Missing integration test configuration");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = crypto.randomUUID();
    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          client.rpc("consume_analysis_for_user", { _user_id: userId }),
        ),
      );
      for (const result of results) expect(result.error).toBeNull();
      expect(results.map((result) => result.data).sort()).toEqual([1, 2, 3, 4, 5]);
      const failed = await client.rpc("consume_analysis_for_user", { _user_id: userId });
      expect(failed.error).toBeNull();
      expect(failed.data).toBe(6);
      const released = await client.rpc("release_analysis_for_user", { _user_id: userId });
      expect(released.error).toBeNull();
      expect(released.data).toBe(5);
      const { data, error } = await client.from("subscriptions")
        .select("analyses_used").eq("user_id", userId).single();
      expect(error).toBeNull();
      expect(data?.analyses_used).toBe(5);
    } finally {
      const { error } = await client.from("subscriptions").delete().eq("user_id", userId);
      if (error) throw error;
    }
  });
});