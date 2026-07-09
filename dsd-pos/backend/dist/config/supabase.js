"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_KEY'];
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
    realtime: { transport: ws },
});
//# sourceMappingURL=supabase.js.map