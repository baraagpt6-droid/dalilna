"use strict";
const fs=require("node:fs"),path=require("node:path"),{Pool}=require("pg");
async function main(){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
 const u=new URL(process.env.DATABASE_URL),ssl=u.searchParams.get("sslmode")==="require"||process.env.DATABASE_SSL==="true";
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,ssl:ssl?{rejectUnauthorized:false}:undefined});
 try{const sql=fs.readFileSync(path.join(__dirname,"..","db","schema.sql"),"utf8"),c=await pool.connect();try{await c.query("BEGIN");await c.query(sql);await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}process.stdout.write("Dalilna marketplace schema v1 applied.\n");}finally{await pool.end();}
}
main().catch(e=>{process.stderr.write((e&&e.stack)||String(e));process.exitCode=1;});
