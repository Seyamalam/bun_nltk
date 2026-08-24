% Minimal svjour3.cls shim for bun_nltk -- wraps article with Springer-like macros
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{svjour3}[2026/08/24 Minimal svjour3 shim for bun_nltk]
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{article}}
\ProcessOptions\relax
\LoadClass[10pt,a4paper,twoside]{article}
\RequirePackage{geometry}
\geometry{a4paper, top=2.5cm, bottom=2.5cm, left=2.2cm, right=2.2cm}
% Springer journal macros
\def\journalname#1{\gdef\@journalname{#1}}
\def\@journalname{Language Resources and Evaluation}
\def\subtitle#1{\gdef\@subtitle{#1}}
\def\@subtitle{}
\def\titlerunning#1{\gdef\@titlerunning{#1}}
\def\authorrunning#1{}
\def\offprints#1{}
\def\at{\,---\,}
\def\email#1{\texttt{#1}}
\let\sv@and\and
\def\and{\unskip, }
\def\institute#1{\gdef\@institute{#1}}
\def\@institute{}
\def\abstractname{Abstract}
\def\keywordname{Keywords}
\renewcommand\maketitle{%
  \begin{center}
    {\LARGE\bfseries\@title\par}
    \ifx\@subtitle\@empty\else\vskip0.6em{\large\@subtitle\par}\fi
    \vskip1.2em
    {\large\@author\par}
    \vskip0.8em
    {\small\itshape\@institute\par}
    \vskip0.6em
    {\small\@date\par}
  \end{center}
  \vskip1.2em
}
% Abstract environment as in svjour3
\renewenvironment{abstract}{%
  \small
  \begin{center}{\bfseries \abstractname\vspace{-.5em}\vspace{\z@}}\end{center}
  \quotation
}{\endquotation\vskip0.9em}
\def\keywords#1{\par\small\noindent{\bfseries \keywordname:} #1\par\vskip1em}
\RequirePackage{titlesec}
\titleformat{\section}{\large\bfseries}{\thesection}{1em}{}
\titleformat{\subsection}{\normalsize\bfseries}{\thesubsection}{1em}{}
\RequirePackage{caption}
\captionsetup{font=small, labelfont=bf}
\def\bibname{References}
\endinput
