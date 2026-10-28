const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('student and teacher use independent Supabase Auth storage',()=>{
 const calls=[],window={SIDE_CONFIG:{SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'key'},supabase:{createClient:(url,key,options)=>{const client={url,key,options};calls.push(client);return client;}}};
 vm.runInNewContext(fs.readFileSync('services/supabase_client.js','utf8'),{window,console});
 const api=window.SIDE.SupabaseClient,teacher=api.get(),student=api.getStudent();
 assert.notEqual(teacher,student);assert.equal(student.options.auth.storageKey,'side-student-auth');assert.equal(api.getStudent(),student);assert.equal(api.get(),teacher);assert.equal(calls.length,2);
});
