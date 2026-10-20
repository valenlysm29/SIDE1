'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {institutionalEmail}=require('../js/teacher_auth.js');
test('teacher registration accepts only institutional addresses and explicit exceptions',()=>{
  for(const value of ['docente@upch.pe',' Docente@UPCH.PE '])assert.equal(institutionalEmail(value),true);
  for(const value of ['upch.pe@gmail.com','docente@upch.pe.ejemplo.com','@upch.pe','uno dos@upch.pe','docente@example.org'])assert.equal(institutionalEmail(value),false);
  assert.equal(institutionalEmail('demo@example.org',['demo@example.org']),true);
});
