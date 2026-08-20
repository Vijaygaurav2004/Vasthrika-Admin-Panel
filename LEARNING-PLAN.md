# Gaurav's 4-Week "Stop Being a Fake" Plan

Goal: stop feeling like a vibe coder. By week 4 you can open a Vasthrika
file, know what each line does, and change it on purpose.

Rules:
- ~1 hour a day. Missing a day is fine. Quitting is not.
- The textbook is YOUR code. No boring tutorial to-do apps.
- After each week there's a "Prove it" task. If you can do it, you learned it.

---

## WEEK 1 — Read one real file end to end
File: lib/supabase/client.ts  (your simplest real file)

Learn these words by finding them in THAT file:
- import  -> "bring in code someone else wrote"
- const   -> "make a named box that holds a value"
- process.env.X -> "a secret setting kept outside the code"
- export  -> "let other files use this thing"
- function -> "a reusable block that does a job"

Do: open the file, and out loud, say what each line does in plain English.
Prove it: explain to me (or a friend) what `supabase` is and why the URL
and key come from process.env instead of being typed in the file.

---

## WEEK 2 — JavaScript basics (the actual language)
Free resource: javascript.info  (sections 1-4 only). Or ask me.

Learn: variables, strings/numbers, if/else, arrays, objects, functions.
That's 90% of what you use daily. Ignore everything fancier for now.

Do it INSIDE your world: open lib/utils.ts. It's 5 lines. The `cn`
function takes "...inputs" and merges CSS class names. By end of week
you should understand what `...inputs` (a "rest parameter") means.

Prove it: write a tiny function on your own (anywhere) that takes two
numbers and returns the bigger one. No AI. That's it.

---

## WEEK 3 — React & components (why your buttons are "components")
File: components/ui/badge.tsx  (a real, small component you already use)

Learn:
- A component = a function that returns UI (that <div> at the bottom).
- props = the inputs you pass a component, like variant="destructive".
- Notice `variant` has options: default, secondary, destructive, outline.

Do: find every place in the app that uses <Badge ... />. See how changing
`variant` changes the color. Change one badge's variant and watch it.
Prove it: add a NEW color option (e.g. "success" = green) to badge.tsx
and use it somewhere. This is a real change to your real app.

---

## WEEK 4 — Make a real change & fix a real break
File: pick any page in app/(admin)/ — e.g. dashboard/page.tsx

Do:
1. Change some visible text or a label yourself.
2. Deliberately break something small, see the error, then fix it.
   (Breaking-and-fixing is where "real" developers are actually made.)
3. Run the app locally: `npm run dev`, open it, see your change live.

Prove it: make one improvement you actually want in Vasthrika, by
yourself, start to finish. When it works, you are no longer a vibe coder.
You're a developer who uses AI. That's the goal.

---

## What NOT to do (so you don't get lost)
- No Swift (unless you decide you want iPhone apps specifically).
- No DSA / LeetCode. Not needed to build products.
- No AI/ML courses. Not needed for this.
- Don't learn 5 languages. One (JavaScript) until it's boring-easy.

## How to use me
When stuck, don't ask me to "just fix it." Ask: "explain what this line
does" or "why did this break?" Make me your teacher, not your autopilot.
That single habit is the whole difference.
