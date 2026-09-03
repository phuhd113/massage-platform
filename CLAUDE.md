# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Quy ước của dự án nằm ở `.claude/rules/`, mỗi file một chủ đề, được nạp tự động cùng file này.
File nào khai `paths` frontmatter thì chỉ nạp khi đang làm việc với file khớp glob đó — hiện có
`migrations.md` (`src/Massage.Api/Data/**`) và `testing-layers.md` (`tests/**`).

Frontend Next.js có hướng dẫn riêng ở [apps/web/CLAUDE.md](apps/web/CLAUDE.md), chỉ nạp khi làm
việc dưới `apps/web`.
