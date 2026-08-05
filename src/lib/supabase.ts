import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ttzcukhopmrktnfluimg.supabase.co";

const supabaseAnonKey = "sb_publishable_wFjedV-hm4JRpNZdURsryA_XjkVxbr1";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
