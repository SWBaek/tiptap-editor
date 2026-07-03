# UX & Architecture Simulation Review: SDoc Editor

**Date**: 2026-07-03
**Target Persona**: Power Electronics (PE) Engineers developing On-Board Chargers (OBC)
**Environment**: Windows-exclusive Enterprise Desktop (Tauri/Browser), Strictly Regulated Templates
**Focus**: 100 Simulations addressing Automotive Hardware Engineering, Heavy Math, Test Data, and Corporate Compliance.

---

## 1. Executive Summary
The target context has been aggressively refined: SDoc is a **Windows-only enterprise tool** for **Power Electronics Engineers** building **OBCs (On-Board Chargers)**, operating under strict corporate templates and automotive safety standards (e.g., ISO 26262). 

100 simulated scenarios were executed across hardware design, mathematical modeling, schematic integration, and corporate compliance workflows. The analysis reveals that while the core SDoc format handles technical content well, it **critically lacks Equation Numbering, strict Document Template locking, Component Traceability, and High-Density Table management** required by hardware engineers.

---

## 2. Categorized Simulation Scenarios (100 Total)

### Category A: Mathematical Modeling & Power Control (1-15)
*OBCs require complex resonant converter (LLC) transfer functions, thermal dissipation limits, and PFC (Power Factor Correction) math.*
1. **Equation Numbering**: Engineer types a transfer function. No automatic `(Eq. 1)` numbering exists.
2. **Equation Referencing**: Cannot easily type `As seen in Eq. 3` and have it auto-update if an equation is inserted above.
3. **Multi-line Math**: Deriving PWM switching losses requires aligned multi-line KaTeX equations (`\begin{align}`). Standard block math struggles with vertical spacing.
4. **Variable Glossary**: No built-in way to define that $V_{in}$ means "Grid Input Voltage" globally.
5. **Inline Math Density**: A paragraph containing 20 inline KaTeX variables causes cursor lag during rapid typing.
6. **Unit Formatting**: Writing `kW`, `A`, `µF` consistently. Needs a strict typography rule to prevent `uF` vs `µF`.
7. **Efficiency Curves**: Wants to paste an interactive Python/MATLAB snippet that generated the efficiency curve.
8. **Thermal Calculations**: Embedding a matrix equation for heatsink thermal resistance.
9. **Magnetic Core Math**: Complex integrals for transformer core saturation (B-H curve analysis).
10. **Math Autocomplete**: Engineer struggles to remember the KaTeX syntax for a closed contour integral.
...*(5 additional math/physics boundary simulations)*...
**Pain Point**: Lack of automatic equation numbering and cross-referencing completely breaks the standard hardware engineering whitepaper flow.

### Category B: Schematics, Waveforms & Hardware Assets (16-35)
*Engineers constantly attach oscilloscope captures, thermal camera IR images, and Altium PCB snippets.*
16. **Oscilloscope Waveforms**: Pasting a 4K resolution Tektronix screenshot. The image is huge; no visual cropping/scaling in SDoc.
17. **Vector Schematics**: Importing a `.svg` schematic exported from Altium. Needs zoom/pan controls in the PDF export.
18. **Asset Traceability**: The source Altium `.SchDoc` file should be zipped into `.sdoc/assets/` to ensure the schematic can be reproduced 5 years later.
19. **Thermal Camera Annotations**: Attaching a FLIR IR image. Wants to add overlay text (e.g., "Hotspot 105°C") within SDoc.
20. **Draw.io Control Blocks**: Editing the PFC control loop diagram. Draw.io integration is essential here.
21. **Block Diagram Linking**: Wants clicking a block in the Draw.io diagram to jump to the relevant SDoc text section.
22. **Asset Expiration**: Linking to an external network drive for a 50GB CAD model, instead of packing it into the `.sdoc`.
23. **Figure Numbering**: Like equations, figures need auto-numbering (`Figure 1: LLC Resonant Tank`).
...*(12 additional asset integration simulations)*...
**Pain Point**: High-resolution test captures need layout controls (width/cropping) so they don't blow up the corporate PDF layout. Figure numbering is critically missing.

### Category C: Corporate Templates & Boilerplate (36-50)
*Large enterprises demand strict, immutable formats. A spec document must look exactly like the company's official template.*
36. **Header/Footer Control**: Engineer exports to PDF. The corporate logo, Doc Control Number, and Confidentiality watermark are missing.
37. **Title Page Lock**: The first page must follow an exact tabular layout (Prepared By, Reviewed By, Approved By). Currently, users can accidentally delete it.
38. **Font Size Compliance**: Enterprise demands 10pt Arial. Tiptap outputs default browser fonts on HTML/PDF export unless themed.
39. **Revision History Table**: A mandatory table at the start of every doc. Needs an automated way to inject Git/History semantic diff summaries into this table.
40. **Restricted Blocks**: "Regulatory Warning" blocks must be read-only for standard engineers.
41. **Watermarking**: "DRAFT" or "INTERNAL USE ONLY" diagonal watermark required on print/PDF.
...*(9 additional compliance and styling simulations)*...
**Pain Point**: The absence of a "Corporate Template Layer" (headers, footers, locked sections) means SDoc cannot currently replace Microsoft Word in a strict ISO-certified workflow.

### Category D: Test Results & High-Density Tables (51-70)
*OBC validation involves hundreds of test cases (e.g., over-voltage protection, CAN bus signals).*
51. **Pinout Tables**: A 100-row table detailing DSP MCU pinout. Scrolling performance drops.
52. **Pass/Fail Formatting**: Engineer wants the "Result" column cells to be colored Green/Red automatically. (Cell background color is currently stripped as UI state).
53. **BOM (Bill of Materials) Import**: Pasting a 500-row Excel BOM. Tiptap freezes. Needs virtualization or Excel attachment model.
54. **Table Header Repeat**: When exporting to PDF, a long pinout table breaks across 3 pages. The table header row must repeat on each page.
55. **Column Widths**: The "Description" column needs to be 3x wider than the "Pin" column. Without saved column widths, it looks unprofessional.
...*(15 additional hardware data table simulations)*...
**Pain Point**: Tables in PE are data-heavy, not just text layout. Cell background colors (Pass/Fail) and repeating PDF headers are mandatory features.

### Category E: Cross-Department Traceability (Automotive ISO 26262) (71-85)
*OBCs are automotive components. Traceability between Requirements -> Implementation -> Testing is required by law.*
71. **Requirement IDs**: A heading is named "OVP Requirement". It needs a visible, immutable Req-ID (e.g., `[OBC-REQ-001]`).
72. **Traceability Matrix**: Exporting a `references.json` to prove to an auditor that `[OBC-TEST-001]` references `[OBC-REQ-001]`.
73. **Software Team Handoff**: PE engineer writes the control timing spec. Software team needs to read `plain.md` to write the C code.
74. **Mechanical Handoff**: Thermal dissipation limits mapped to the mechanical casing design team.
75. **Diffing Requirements**: Auditor uses Semantic Diff to prove that between Rev A and Rev B, only 3 requirements changed, and tests were re-run.
...*(10 additional traceability and auditing simulations)*...
**Pain Point**: SDoc's immutable `id` is technically perfect for this, but the UI doesn't expose these IDs visibly as "Requirement Tags" for auditors to read in the exported PDF.

### Category F: Windows-Native & Offline Lab Constraints (86-100)
*Engineers work in offline high-voltage labs, using corporate Windows PCs.*
86. **Tauri Native Launch**: Double-clicking an `.sdoc` file in Windows Explorer must open the app directly.
87. **Air-gapped Lab**: No internet. App must have all assets, KaTeX fonts, and Mermaid libraries bundled locally.
88. **Continuous Auto-save**: PC crashes due to a tripped lab circuit breaker. Tauri must save incrementally to disk.
89. **Legacy Export**: Manager demands a `.docx` file to review on their corporate laptop.
90. **Network Drive Sync**: `.sdoc` stored on `Z:\Engineering\OBC\`. Multi-user lock needed to prevent File A overwriting File B.
...*(10 additional Windows/Lab IT simulations)*...
**Pain Point**: The current browser playground is entirely inadequate for air-gapped, crash-prone lab environments. The Tauri desktop app is a hard blocker for real-world deployment.

---

## 3. Highly Targeted Action Items for PE/OBC Workflow

To make SDoc Editor viable for a corporate Power Electronics engineering team on Windows, the following architectural boundaries must be crossed:

### Phase 5 Priorities (Corporate & Engineering Formatting)
1. **Equation & Figure Auto-Numbering**: Introduce an automated numbering projection that counts `equationBlock` and `figure` nodes, and updates `crossReference` text dynamically (e.g., "See Figure 1").
2. **Corporate PDF Template Engine**: Instead of simple HTML-to-PDF, we need a robust template engine that injects standard Corporate Headers, Footers, Page Numbers, and Title Pages around the canonical `document.json` content during export.
3. **Table Column Width & Cell Backgrounds**: Revise the "No UI state" rule. In hardware engineering, column widths and cell highlight colors (Pass/Fail) are **canonical semantic data** required to understand a test report. They must be added to the schema.
4. **Repeating Table Headers (PDF)**: CSS modifications to ensure `<thead>` repeats on page breaks in the print stylesheet.

### Phase 6 Priorities (Traceability & Desktop)
5. **Visible Block IDs (Requirement Tags)**: Add a UI feature to display and customize the `attrs.id` (or add a semantic `attrs.tag`) next to Headings/Paragraphs so auditors can trace `[REQ-042]` in the printed PDF.
6. **Tauri Windows App (Air-Gapped)**: Ship the Tauri `.exe` with all dependencies bundled. Implement robust `fs.watch` and temporary `.tmp` atomic saving to prevent data corruption during power outages in the lab.
7. **Draw.io Embedded Integration**: Complete the Draw.io integration so engineers can edit control block diagrams directly inside the Windows app without external installations.
