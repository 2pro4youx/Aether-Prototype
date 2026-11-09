import {
  ColorPalette,
  StudyDay,
  TaskItem,
  PlannerEntry,
  NotebookSource,
  OneNoteNotebook,
  LibraryItem,
  SubjectAnalytics,
  AuditLog,
  GeminiConversation,
} from '../types';

export const PALETTES: ColorPalette[] = [
  {
    id: 'gold-obsidian',
    name: 'Imperial Gold & Obsidian',
    description: 'Bespoke crimson & auric gold with deep interstellar obsidian slate',
    primary: '#f59e0b',
    accent: '#dc2626',
    gradient: 'from-amber-500 via-amber-600 to-red-600',
    bgDark: '#090d16',
    textAccent: 'text-amber-400',
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    description: 'Deep ruby reds with rose gold highlights',
    primary: '#e11d48',
    accent: '#fb7185',
    gradient: 'from-rose-500 via-red-600 to-amber-500',
    bgDark: '#12070a',
    textAccent: 'text-rose-400',
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Glacial cyan with crisp titanium blue',
    primary: '#06b6d4',
    accent: '#38bdf8',
    gradient: 'from-cyan-500 via-sky-600 to-blue-700',
    bgDark: '#071018',
    textAccent: 'text-cyan-400',
  },
  {
    id: 'emerald-solarium',
    name: 'Emerald Solarium',
    description: 'Botanical deep forest emerald with lime luminescence',
    primary: '#10b981',
    accent: '#34d399',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    bgDark: '#05130f',
    textAccent: 'text-emerald-400',
  },
  {
    id: 'cyberpunk-amber',
    name: 'Cyberpunk Amber',
    description: 'Electric cadmium amber with high-contrast sulfur neon',
    primary: '#eab308',
    accent: '#f97316',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    bgDark: '#141005',
    textAccent: 'text-yellow-400',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep royal ultramarine with celestial cobalt shimmer',
    primary: '#3b82f6',
    accent: '#6366f1',
    gradient: 'from-blue-500 via-indigo-600 to-violet-800',
    bgDark: '#070b19',
    textAccent: 'text-blue-400',
  },
  {
    id: 'travertine-minimal',
    name: 'Travertine Minimal',
    description: 'Warm editorial sandstone and ivory with rich terracotta red accents',
    primary: '#c84b31',
    accent: '#8e2820',
    gradient: 'from-amber-200 via-rose-600 to-red-800',
    bgDark: '#140c0b',
    textAccent: 'text-rose-400',
  },
  {
    id: 'amethyst-royal',
    name: 'Amethyst Royal',
    description: 'Deep astral purple with imperial orchid accents',
    primary: '#a855f7',
    accent: '#d946ef',
    gradient: 'from-purple-500 via-fuchsia-600 to-pink-600',
    bgDark: '#12081c',
    textAccent: 'text-purple-400',
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Neon Dawn',
    description: 'Vibrant magenta paired with electric turquoise and gold',
    primary: '#ec4899',
    accent: '#14b8a6',
    gradient: 'from-pink-500 via-purple-600 to-teal-400',
    bgDark: '#0e0817',
    textAccent: 'text-pink-400',
  },
  {
    id: 'titanium-mono',
    name: 'Titanium Monochrome',
    description: 'Ultra-pure silver steel with surgical contrast',
    primary: '#94a3b8',
    accent: '#e2e8f0',
    gradient: 'from-slate-400 via-slate-600 to-zinc-900',
    bgDark: '#0a0a0c',
    textAccent: 'text-slate-300',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    description: 'Crisp autumnal maple leaves, burnt sienna, and warm golden amber',
    primary: '#e05a1b',
    accent: '#b91c1c',
    gradient: 'from-amber-500 via-orange-600 to-red-700',
    bgDark: '#130804',
    textAccent: 'text-orange-400',
  },
  {
    id: 'black-night',
    name: 'Black Night',
    description: 'Deep cosmic obsidian void with off-white luminescence and dark carbon shadow glow',
    primary: '#f1f5f9',
    accent: '#cbd5e1',
    gradient: 'from-slate-100 via-slate-300 to-zinc-700',
    bgDark: '#040404',
    textAccent: 'text-slate-100',
  },
];

// Generate 365 days of study activity (52 weeks x 7 days)
export function generateYearStudyData(): StudyDay[] {
  const days: StudyDay[] = [];
  const today = new Date();
  
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Seed realistic study pattern: heavier on weekdays, occasional rest days
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const rand = Math.random();

    let count = 0;
    let hours = 0;

    if (rand > 0.22) {
      if (rand > 0.85) {
        count = 4;
        hours = +(4.5 + Math.random() * 3).toFixed(1);
      } else if (rand > 0.6) {
        count = 3;
        hours = +(3 + Math.random() * 1.5).toFixed(1);
      } else if (rand > 0.35) {
        count = 2;
        hours = +(1.5 + Math.random() * 1.5).toFixed(1);
      } else {
        count = 1;
        hours = +(0.5 + Math.random() * 1).toFixed(1);
      }
    }

    if (isWeekend && rand < 0.4) {
      count = 0;
      hours = 0;
    }

    days.push({
      date: dateStr,
      count,
      hours,
    });
  }
  return days;
}

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Review Self-Attention Mechanism derivation in Vaswani et al.',
    category: 'Deep Learning',
    priority: 'high',
    completed: true,
    dueDate: 'Today',
  },
  {
    id: 'task-2',
    title: 'Complete problem set on Hamiltonian operators and eigenvalues',
    category: 'Quantum Mechanics',
    priority: 'high',
    completed: false,
    dueDate: 'Tomorrow',
  },
  {
    id: 'task-3',
    title: 'Synthesize lecture notes on Distributed Consensus & Raft protocol',
    category: 'Computer Systems',
    priority: 'medium',
    completed: false,
    dueDate: 'Nov 12',
  },
  {
    id: 'task-4',
    title: 'Draft literature review outline for organic photovoltaics project',
    category: 'Materials Science',
    priority: 'medium',
    completed: false,
    dueDate: 'Nov 15',
  },
  {
    id: 'task-5',
    title: 'Re-index NotebookLM sources for Computational Biology exam',
    category: 'Bioinformatics',
    priority: 'low',
    completed: true,
    dueDate: 'Yesterday',
  },
];

export const INITIAL_PLANNERS: PlannerEntry[] = [
  {
    id: 'plan-1',
    title: 'Transformer Architecture Mastery Sprint',
    subject: 'Artificial Intelligence',
    timeSlot: '09:00 - 11:30 AM',
    date: 'Daily Sprint',
    milestone: 'Implement FlashAttention kernel in PyTorch/Triton',
    progress: 75,
  },
  {
    id: 'plan-2',
    title: 'Quantum Computing Midterm Revision',
    subject: 'Physics',
    timeSlot: '02:00 - 04:30 PM',
    date: 'Nov 09 - Nov 14',
    milestone: 'Shor algorithm circuit simulation & phase estimation',
    progress: 40,
  },
  {
    id: 'plan-3',
    title: 'Distributed Systems Capstone Specification',
    subject: 'Systems Engineering',
    timeSlot: '05:00 - 07:00 PM',
    date: 'Phase 2 Architecture',
    milestone: 'Formal TLA+ safety proofs for Paxos election logic',
    progress: 20,
  },
];

export const INITIAL_SOURCES: NotebookSource[] = [
  {
    id: 'src-1',
    title: 'Attention Is All You Need (Vaswani et al.)',
    type: 'pdf',
    excerpt: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
    fullContent: `The Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution. In place of recurrence, multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. Scaled dot-product attention computes Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V. Residual connections and layer normalization are applied after each sub-layer.`,
    words: 1420,
    selected: true,
    dateAdded: '2 days ago',
  },
  {
    id: 'src-2',
    title: 'Quantum State Tomography & Density Matrix',
    type: 'notes',
    excerpt: 'State tomography is the process by which an unknown quantum state is reconstructed from a series of measurements...',
    fullContent: `A pure quantum state is represented by a ray in Hilbert space |psi>, whereas a mixed state is represented by a density matrix rho = sum_i p_i |psi_i><psi_i|. Properties: Tr(rho) = 1, rho is positive semi-definite. Quantum fidelity between two states measures overlap F(rho, sigma) = (Tr(sqrt(sqrt(rho) sigma sqrt(rho))))^2. In qubit tomography, measuring expectation values along Pauli X, Y, Z axes completely reconstructs the single-qubit Bloch vector.`,
    words: 890,
    selected: true,
    dateAdded: 'Yesterday',
  },
  {
    id: 'src-3',
    title: 'Principles of Neural Dynamics and Synaptic Plasticity',
    type: 'text',
    excerpt: 'Synaptic plasticity—the activity-dependent modification of synaptic transmission—is the cellular basis for learning...',
    fullContent: `Hebbian learning principle: neurons that fire together wire together. Spike-timing-dependent plasticity (STDP) refines this: if a presynaptic spike arrives a few milliseconds prior to the postsynaptic action potential, long-term potentiation (LTP) occurs. Conversely, if the postsynaptic neuron fires first, long-term depression (LTD) is triggered. This asymmetric temporal window enables causal credit assignment across neural circuits.`,
    words: 1105,
    selected: true,
    dateAdded: '3 hours ago',
  },
];

export const INITIAL_ONENOTE_NOTEBOOKS: OneNoteNotebook[] = [
  {
    id: 'nb-1',
    title: 'Neural Networks & Deep Learning',
    description: 'Comprehensive research and architecture notes for LLMs and vision models',
    sections: [
      {
        id: 'sec-1',
        title: '01. Attention Mechanisms',
        color: '#f59e0b',
        pages: [
          {
            id: 'page-1',
            title: 'Scaled Dot-Product & FlashAttention',
            updatedAt: 'Updated 20 mins ago',
            blocks: [
              {
                id: 'b-1',
                type: 'h1',
                content: 'Scaled Dot-Product Attention Foundations',
              },
              {
                id: 'b-2',
                type: 'paragraph',
                content: 'The core attention mechanism projects inputs into query (Q), key (K), and value (V) matrices. The scaling factor 1/sqrt(d_k) prevents dot products from growing excessively large for higher dimensions, which otherwise causes softmax gradients to vanish.',
              },
              {
                id: 'b-3',
                type: 'callout',
                content: 'Mathematical Formulation: Attention(Q, K, V) = Softmax((Q * K^T) / sqrt(d_k)) * V',
              },
              {
                id: 'b-4',
                type: 'image',
                imageUrl: '/assets/aistudio/image_0b4c09c1.png',
                caption: 'Figure 1: Scaled Dot-Product & Multi-Head Attention Architecture',
                width: 45,
                height: 360,
                sideMode: 'left',
                sideBlockType: 'code',
                sideCodeLanguage: 'python',
                sideCodeContent: `import torch
import torch.nn.functional as F

def scaled_dot_product_attention(q, k, v, mask=None):
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / (d_k ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, v), weights`,
                content: '',
              },
              {
                id: 'b-5',
                type: 'h2',
                content: 'Key Advantages of FlashAttention',
              },
              {
                id: 'b-6',
                type: 'todo',
                content: 'Avoid materializing the N x N attention matrix in GPU HBM',
                checked: true,
              },
              {
                id: 'b-7',
                type: 'todo',
                content: 'Tiling inputs into SRAM blocks to achieve IO-awareness',
                checked: true,
              },
              {
                id: 'b-8',
                type: 'todo',
                content: 'Implement online softmax normalization across chunks',
                checked: false,
              },
              {
                id: 'b-9',
                type: 'quote',
                content: '"By keeping intermediate attention matrices inside fast GPU on-chip SRAM, FlashAttention achieves 2-4x wall-clock speedup without modifying the mathematical output."',
              },
            ],
          },
          {
            id: 'page-2',
            title: 'Rotary Position Embeddings (RoPE)',
            updatedAt: 'Yesterday',
            blocks: [
              {
                id: 'b-rope-1',
                type: 'h1',
                content: 'Rotary Position Embeddings (RoPE)',
              },
              {
                id: 'b-rope-2',
                type: 'paragraph',
                content: 'RoPE encodes relative position by rotating the query and key vectors in complex 2D subspaces. Unlike absolute sinusoidal embeddings, the dot product between rotated vectors depends solely on their relative token distance.',
              },
              {
                id: 'b-rope-3',
                type: 'callout',
                content: 'Applied in modern frontier LLMs including LLaMA, Mistral, and Gemini.',
              },
            ],
          },
        ],
      },
      {
        id: 'sec-2',
        title: '02. Optimization & Quantization',
        color: '#dc2626',
        pages: [
          {
            id: 'page-opt-1',
            title: 'FP8 & AWQ Weight Quantization',
            updatedAt: '3 days ago',
            blocks: [
              {
                id: 'b-opt-1',
                type: 'h1',
                content: 'Activation-Aware Weight Quantization (AWQ)',
              },
              {
                id: 'b-opt-2',
                type: 'paragraph',
                content: 'AWQ demonstrates that not all weights are equally important: protecting the top 1% salient weights based on activation magnitudes preserves perplexity while quantizing the remaining 99% to INT4.',
              },
            ],
          },
        ],
      },
      {
        id: 'sec-3',
        title: '03. Lab Bench & Experiments',
        color: '#10b981',
        pages: [
          {
            id: 'page-lab-1',
            title: 'Benchmarking Inference Latency',
            updatedAt: 'Oct 30',
            blocks: [
              {
                id: 'b-lab-1',
                type: 'h1',
                content: 'End-to-End Latency Profile',
              },
              {
                id: 'b-lab-2',
                type: 'paragraph',
                content: 'Time-to-first-token (TTFT) and token generation throughput across varied context windows (4k vs 32k tokens).',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'nb-2',
    title: 'Quantum Information & Algorithms',
    description: 'Quantum circuits, entanglement, error correction, and gate fidelity',
    sections: [
      {
        id: 'sec-q1',
        title: '01. Qubit Gates & Teleportation',
        color: '#3b82f6',
        pages: [
          {
            id: 'page-q1',
            title: 'Quantum Teleportation Protocol',
            updatedAt: '4 days ago',
            blocks: [
              {
                id: 'bq-1',
                type: 'h1',
                content: 'Quantum Teleportation Circuit',
              },
              {
                id: 'bq-2',
                type: 'paragraph',
                content: 'Teleportation transmits an unknown quantum state |psi> using an EPR pair and two classical bits of communication, without violating the no-cloning theorem.',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const INITIAL_LIBRARY: LibraryItem[] = [
  {
    id: 'lib-1',
    title: 'Attention Is All You Need Synthesis',
    type: 'notebook',
    folder: 'NotebookLM Research',
    updatedAt: '2 hours ago',
    tags: ['Transformer', 'LLM', 'Grounded'],
    description: 'Interactive NotebookLM workspace with grounded PDF sources and study guide',
    star: true,
  },
  {
    id: 'lib-2',
    title: 'Neural Networks & Deep Learning',
    type: 'onenote',
    folder: 'OneNote Notebooks',
    updatedAt: '20 mins ago',
    tags: ['OneNote', 'FlashAttention', 'RoPE', 'Code'],
    description: 'Multi-section hierarchical notebook with rich block editing and Python implementations',
    star: true,
  },
  {
    id: 'lib-3',
    title: 'Fall Semester Study Sprint Plan',
    type: 'planner',
    folder: 'Semester Planners',
    updatedAt: 'Yesterday',
    tags: ['Schedules', 'Milestones', 'Exams'],
    description: 'Comprehensive study schedule tracking 3 concurrent master subjects',
    star: false,
  },
  {
    id: 'lib-4',
    title: 'Distributed Consensus & Paxos Proofs',
    type: 'project',
    folder: 'Active Projects',
    updatedAt: 'Nov 02',
    tags: ['Raft', 'Paxos', 'TLA+'],
    description: 'Formal verification project comparing Raft leader election with Multi-Paxos',
    star: true,
  },
  {
    id: 'lib-5',
    title: 'Quantum State Tomography Reference',
    type: 'document',
    folder: 'Personal Archives',
    updatedAt: 'Oct 28',
    tags: ['Physics', 'Qubits', 'Density Matrix'],
    description: 'Comprehensive mathematical cheat sheet and Pauli operators reference guide',
    star: false,
  },
];

export const INITIAL_SUBJECT_ANALYTICS: SubjectAnalytics[] = [
  {
    subject: 'Computer Science & AI',
    minutes: 940,
    percentage: 38,
    color: '#f59e0b',
  },
  {
    subject: 'Quantum Physics',
    minutes: 620,
    percentage: 25,
    color: '#3b82f6',
  },
  {
    subject: 'Neuroscience & Biology',
    minutes: 410,
    percentage: 17,
    color: '#10b981',
  },
  {
    subject: 'Mathematics & Statistics',
    minutes: 320,
    percentage: 13,
    color: '#8b5cf6',
  },
  {
    subject: 'Scientific Writing & Ethics',
    minutes: 170,
    percentage: 7,
    color: '#ec4899',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '10:42 AM',
    action: 'Grounded Query Generated',
    detail: 'Executed AI chat synthesis referencing 3 sources on Self-Attention Mechanism',
    category: 'ai',
  },
  {
    id: 'aud-2',
    timestamp: '09:15 AM',
    action: 'OneNote Block Edited',
    detail: 'Added Python implementation snippet to FlashAttention page in section 01',
    category: 'note',
  },
  {
    id: 'aud-3',
    timestamp: '08:30 AM',
    action: 'Task Completed',
    detail: 'Checked off "Review Self-Attention Mechanism derivation"',
    category: 'task',
  },
  {
    id: 'aud-4',
    timestamp: 'Yesterday',
    action: 'Source Uploaded',
    detail: 'Extracted and indexed "Principles of Neural Dynamics" (1,105 words)',
    category: 'source',
  },
  {
    id: 'aud-5',
    timestamp: '2 days ago',
    action: 'Study Session Logged',
    detail: 'Completed 4.2 hours across Computer Science and Quantum Mechanics',
    category: 'system',
  },
];

export const INITIAL_GEMINI_CONVERSATIONS: GeminiConversation[] = [
  {
    id: 'conv-1',
    title: 'Attention Mechanisms & Transformer Scaling',
    createdAt: 'Today, 10:30 AM',
    updatedAt: 'Just now',
    model: 'gemini-3.8-flash',
    pinned: true,
    messages: [
      {
        id: 'msg-1-1',
        role: 'user',
        content: 'Can you summarize how Scaled Dot-Product Attention works and write down its exact mathematical formulation?',
        timestamp: '10:30 AM',
      },
      {
        id: 'msg-1-2',
        role: 'assistant',
        content: `### Scaled Dot-Product Attention

Scaled Dot-Product Attention maps queries $Q$ and key-value pairs $(K, V)$ to an output vector. The dot products of queries with keys are scaled by $\\frac{1}{\\sqrt{d_k}}$ to prevent gradient vanishing in the Softmax softmax function for large dimensions $d_k$.

Mathematical Formulation: Attention(Q, K, V) = Softmax((Q * K^T) / sqrt(d_k)) * V

$$\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V$$

#### Key Advantages:
1. **Parallelism**: Matrix multiplication replaces recurrence, saturating modern GPU tensor cores.
2. **Global Context**: Maximum path length between any two tokens is $O(1)$.
3. **Memory Footprint**: FlashAttention-2 further optimizes memory by tiling in SRAM without materializing the $N \\times N$ attention matrix.`,
        timestamp: '10:31 AM',
        model: 'gemini-3.8-flash',
      },
    ],
  },
  {
    id: 'conv-2',
    title: 'Quantum Superposition & Decoherence',
    createdAt: 'Yesterday, 3:15 PM',
    updatedAt: 'Yesterday',
    model: 'gemini-4-argon',
    messages: [
      {
        id: 'msg-2-1',
        role: 'user',
        content: 'Explain why macroscopic quantum superposition collapses so rapidly through environmental decoherence.',
        timestamp: '3:15 PM',
      },
      {
        id: 'msg-2-2',
        role: 'assistant',
        content: `### Environmental Decoherence & The Measurement Problem

Decoherence is the dynamical process wherein a quantum system becomes entangled with environmental degrees of freedom (photons, thermal phonons, air molecules):

$$|\\psi\\rangle = \\alpha |0\\rangle + \\beta |1\\rangle \\xrightarrow{\\text{Environment}} \\alpha |0\\rangle|E_0\\rangle + \\beta |1\\rangle|E_1\\rangle$$

When we trace out the environment $\\operatorname{Tr}_E(\\rho)$, the off-diagonal density matrix terms (quantum coherences) decay exponentially:

$$\\rho_{\\mathrm{system}}(t) \\approx \\begin{pmatrix} |\\alpha|^2 & \\alpha \\beta^* e^{-\\Gamma t} \\\\ \\alpha^* \\beta e^{-\\Gamma t} & |\\beta|^2 \\end{pmatrix}$$

For macroscopic objects, the decoherence rate $\\Gamma$ is on the order of $10^{20} \\text{ s}^{-1}$, rendering classical appearance virtually instantaneous.`,
        timestamp: '3:16 PM',
        model: 'gemini-4-argon',
      },
    ],
  },
  {
    id: 'conv-3',
    title: 'React Performance & Structural Sharing',
    createdAt: '2 days ago',
    updatedAt: '2 days ago',
    model: 'gemini-3.8-flash',
    messages: [
      {
        id: 'msg-3-1',
        role: 'user',
        content: 'How does structural sharing in React state avoid unnecessary re-renders in tree structures like notebooks?',
        timestamp: 'Nov 7',
      },
      {
        id: 'msg-3-2',
        role: 'assistant',
        content: `### Structural Sharing vs. Deep Cloning

When mutating deeply nested state, naive operations like \`JSON.parse(JSON.stringify(tree))\` create entirely new object references for every single node. This forces all \`React.memo\` components down the entire hierarchy to re-render.

#### With Structural Sharing:
- Only modified branch nodes allocate new reference wrappers.
- Unmodified siblings preserve their reference: \`prevItem === nextItem\`.
- \`React.memo\` skips reconciliation for all untouched blocks and sidebar tiles, maintaining steady 120 FPS frame timing even under continuous keystrokes.`,
        timestamp: 'Nov 7',
        model: 'gemini-3.8-flash',
      },
    ],
  },
];
