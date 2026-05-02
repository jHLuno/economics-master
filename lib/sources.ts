/**
 * Registry of source PDFs. The ingest script reads these definitions
 * to chunk + embed the corpus at build time.
 */
export type SourceDef = {
  /** Stable identifier used in citations. */
  id: string;
  /** Human-readable title shown in the UI. */
  title: string;
  /** Path to the extracted plain-text file (relative to project root). */
  textFile: string;
};

export const SOURCES: SourceDef[] = [
  {
    id: "intro-econ-2019",
    title: "Introduction to Economics (2019)",
    textFile: "data/raw/intro-econ-2019.txt",
  },
  {
    id: "dilts-microecon-2004",
    title: "Introduction to Microeconomics — Dilts (E201, 2004)",
    textFile: "data/raw/dilts-microecon-2004.txt",
  },
  {
    id: "vansickle-rogge-1954",
    title: "Introduction to Economics — Van Sickle & Rogge (1954)",
    textFile: "data/raw/vansickle-rogge-1954.txt",
  },
  {
    id: "econ-class-notes",
    title: "Economics — class notes",
    textFile: "data/raw/econ-class-notes.txt",
  },
];
