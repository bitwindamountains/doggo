# Dog Years blueprint — how to use it with Claude Code

1. Create an empty folder for the app (for example `dog-years/`) and copy everything from
   this blueprint into it: `CLAUDE.md` at the root and the `docs/` folder.
2. Do the M0 **[HUMAN]** steps in `docs/MILESTONES.md` first, especially the Apple
   Family Controls requests. They take the longest.
3. Open the folder in Claude Code and start with this prompt:

> Read CLAUDE.md and every file in docs/. Then start milestone M0 in docs/MILESTONES.md.
> Before writing code, give me a short plan for M0 and list anything you need from me.
> Work one task at a time, run typecheck and tests after each task, tick the checkbox,
> and commit.

4. For later sessions:

> Continue with the next unchecked task in docs/MILESTONES.md.

Tips:
- Keep one milestone per session or two; ask Claude Code to summarize what changed at
  the end of each.
- M1 (the dog engine) is the heart of the product. Run `npm run simulate` and read the
  timelines yourself: if the dog feels naggy on paper, it will feel naggy on a phone.
- Screen time and steps must be tested on real phones. Simulators use mock data.
- If you rename the app, update the bundle ID and App Group in `docs/ARCHITECTURE.md`
  and `CLAUDE.md` before M0.
