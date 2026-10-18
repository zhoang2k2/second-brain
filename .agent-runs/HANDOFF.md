# Handoff

M1 is validated and ready as the base for later milestone branches. The landing shell, root `app/` layout, Tailwind/PostCSS setup, configuration example, knowledge placeholder, and setup documentation are in `feature/m1`.

Before implementing M2, BOSS must select/approve the local model and resource expectations, choose conversation-history storage, define retention/resume/delete behavior, and approve M2 scope and acceptance criteria. Do not download model weights. Once those gates are satisfied, create the M2 branch from the latest valid M1 commit and define FE/BE contracts before implementation.

M3 remains dependent on M2 and the Lesson 08 knowledge-format and privacy decisions. M4 depends on M2/M3 plus explicit provider and end-to-end acceptance decisions.
