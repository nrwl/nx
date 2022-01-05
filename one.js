/*

main.js
async function invokeA() {
  (await import('a')).a()
}

async function invokeB() {
  (await import('b')).b()
}

a.js
async function a() {
  (await import('c')).c()
}

b.js
async function b() {
  (await import('c')).c()
}

c.js
async function c() {
}

      a \
main-    c
      b /


mainabc.js
--> main.js a.js b.js c.js
mainc.js a.js b.js
main.js ac.js bc.js


DCE
- DCE-1   DCE-2

Eval(DCE-1) is a number (file size)






 */
