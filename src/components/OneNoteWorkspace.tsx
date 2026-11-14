import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Lenis from 'lenis';
import { Reorder, useDragControls, motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Code2,
  Quote,
  AlertCircle,
  Heading1,
  Heading2,
  Type,
  Book,
  FolderPlus,
  FilePlus,
  Share2,
  Copy,
  Sparkles,
  GripVertical,
  Check,
  Image as ImageIcon,
  Columns,
  MoveHorizontal,
  MoveVertical,
  Upload,
  Link as LinkIcon,
  Maximize2,
  X,
  ExternalLink,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  Table as TableIcon,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Eraser,
  Sigma,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { OneNoteNotebook, OneNoteSection, OneNotePage, NoteBlock, BlockType, ColorPalette } from '../types';
import { getLanguageTheme, SUPPORTED_LANGUAGES } from '../utils/languageThemes';
import { CodeEditor } from '../utils/codeHighlighter';
import { parseAndRenderMath, renderKatex, normalizeMathExpression, MATH_PRESETS } from '../utils/mathRenderer';

// Auto-expanding textarea that dynamically resizes to content scrollHeight without tall blank containers
const AutoExpandingTextarea: React.FC<{
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}> = ({ id, value, onChange, onKeyDown, placeholder, className, style, autoFocus, onFocus, onBlur }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${Math.max(22, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <textarea
      id={id}
      ref={ref}
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      className={`w-full bg-transparent resize-none overflow-hidden focus:outline-none ${className || ''}`}
      style={style}
      rows={1}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.max(22, e.target.scrollHeight)}px`;
      }}
      onKeyDown={onKeyDown}
    />
  );
};

interface NoteBlockItemProps {
  block: NoteBlock;
  darkMode: boolean;
  themeColor?: string;
  userThemeColor?: string;
  isWorkspaceEntering?: boolean;
  onUpdateContent: (id: string, content: string) => void;
  onUpdateBlock: (id: string, patch: Partial<NoteBlock>) => void;
  onToggleTodo: (id: string) => void;
  onDelete: (id: string) => void;
  onInsertBlockAfter?: (afterBlockId: string, type: BlockType) => void;
  onContextMenu?: (e: React.MouseEvent, block: NoteBlock) => void;
}

const NoteBlockItem: React.FC<NoteBlockItemProps> = React.memo(({
  block,
  darkMode,
  themeColor,
  userThemeColor,
  isWorkspaceEntering = false,
  onUpdateContent,
  onUpdateBlock,
  onToggleTodo,
  onDelete,
  onInsertBlockAfter,
  onContextMenu,
}) => {
  const dragControls = useDragControls();
  const effectiveThemeColor = userThemeColor || themeColor || '#f59e0b';
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parallelMenuRef = useRef<HTMLDivElement>(null);
  const [isEnteringUrl, setIsEnteringUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isParallelMenuOpen, setIsParallelMenuOpen] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [imageFitCover, setImageFitCover] = useState(true);
  const [isSwapping, setIsSwapping] = useState(false);
  const [draggedRowIdx, setDraggedRowIdx] = useState<number | null>(null);
  const [dragOverRowIdx, setDragOverRowIdx] = useState<number | null>(null);
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);
  const tableElementRef = useRef<HTMLTableElement>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{
    x: number;
    y: number;
    cellKey: string;
    rowIdx?: number;
    colIdx: number;
    isHeader: boolean;
  } | null>(null);
  const [hoveredDeleteRowIdx, setHoveredDeleteRowIdx] = useState<number | null>(null);
  const [isMathPresetsOpen, setIsMathPresetsOpen] = useState(false);
  const [isCopiedMath, setIsCopiedMath] = useState(false);
  const [isEditingCalloutMath, setIsEditingCalloutMath] = useState(false);
  const [isEditingParagraphMath, setIsEditingParagraphMath] = useState(false);
  const [isEditingQuoteMath, setIsEditingQuoteMath] = useState(false);

  // Memoized math parsing to avoid re-running KaTeX regexes on every render
  const mathInfo = React.useMemo(() => {
    if (
      block.type === 'paragraph' ||
      block.type === 'callout' ||
      block.type === 'quote' ||
      block.type === 'math'
    ) {
      return parseAndRenderMath(block.content || '');
    }
    return { hasMath: false, html: '' };
  }, [block.type, block.content]);

  // Reorder table rows (clean array splice + cell color remapping)
  const handleReorderRows = (sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    const currentRows = [...(block.tableRows || [['', '', '']])];
    if (sourceIdx < 0 || sourceIdx >= currentRows.length || targetIdx < 0 || targetIdx >= currentRows.length) return;
    const [movedRow] = currentRows.splice(sourceIdx, 1);
    currentRows.splice(targetIdx, 0, movedRow);

    const headers = block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'];
    const totalRows = currentRows.length;
    const totalCols = headers.length;
    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};

    // Copy header colors
    for (let c = 0; c < totalCols; c++) {
      if (oldColors[`th-${c}`]) {
        newColors[`th-${c}`] = oldColors[`th-${c}`];
      }
    }

    const rowIndices = Array.from({ length: totalRows }, (_, i) => i);
    const [movedR] = rowIndices.splice(sourceIdx, 1);
    rowIndices.splice(targetIdx, 0, movedR);

    for (let newR = 0; newR < totalRows; newR++) {
      const oldR = rowIndices[newR];
      for (let c = 0; c < totalCols; c++) {
        if (oldColors[`${oldR}-${c}`]) {
          newColors[`${newR}-${c}`] = oldColors[`${oldR}-${c}`];
        }
      }
    }

    onUpdateBlock(block.id, {
      tableRows: currentRows,
      tableCellColors: newColors,
    });
  };

  // Reorder table columns (clean array splice + cell color remapping)
  const handleReorderCols = (sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    const headers = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
    if (sourceIdx < 0 || sourceIdx >= headers.length || targetIdx < 0 || targetIdx >= headers.length) return;
    const [movedHeader] = headers.splice(sourceIdx, 1);
    headers.splice(targetIdx, 0, movedHeader);

    const rows = (block.tableRows || [['', '', '']]).map((row) => {
      const rowCopy = [...row];
      const [movedCell] = rowCopy.splice(sourceIdx, 1);
      rowCopy.splice(targetIdx, 0, movedCell);
      return rowCopy;
    });

    const totalRows = rows.length;
    const totalCols = headers.length;
    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};

    const colIndices = Array.from({ length: totalCols }, (_, i) => i);
    const [movedCol] = colIndices.splice(sourceIdx, 1);
    colIndices.splice(targetIdx, 0, movedCol);

    for (let newC = 0; newC < totalCols; newC++) {
      const oldC = colIndices[newC];
      if (oldColors[`th-${oldC}`]) {
        newColors[`th-${newC}`] = oldColors[`th-${oldC}`];
      }
      for (let r = 0; r < totalRows; r++) {
        if (oldColors[`${r}-${oldC}`]) {
          newColors[`${r}-${newC}`] = oldColors[`${r}-${oldC}`];
        }
      }
    }

    onUpdateBlock(block.id, {
      tableHeaders: headers,
      tableRows: rows,
      tableCellColors: newColors,
    });
  };

  const handleRowDragStart = (e: React.DragEvent, rIdx: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', `row:${rIdx}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedRowIdx(rIdx);
    setDragOverRowIdx(rIdx);
  };

  const handleRowDragOver = (e: React.DragEvent, rIdx: number) => {
    if (draggedRowIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRowIdx !== rIdx) {
      setDragOverRowIdx(rIdx);
    }
  };

  // FLIP animation on drop: smoothly glides the specific row to its final position
  const handleRowDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIdx = draggedRowIdx;
    setDraggedRowIdx(null);
    setDragOverRowIdx(null);

    if (sourceIdx === null || sourceIdx === targetIdx) return;

    if (tableElementRef.current) {
      const trElements = Array.from(tableElementRef.current.querySelectorAll('tbody tr')) as HTMLElement[];
      const firstTops = trElements.map((tr) => tr.getBoundingClientRect().top);

      handleReorderRows(sourceIdx, targetIdx);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!tableElementRef.current) return;
          const updatedTrs = Array.from(tableElementRef.current.querySelectorAll('tbody tr')) as HTMLElement[];
          const springEase = 'cubic-bezier(0.16, 1, 0.3, 1)';
          const duration = '0.36s';

          updatedTrs.forEach((tr, i) => {
            let oldIdx = i;
            if (i === targetIdx) oldIdx = sourceIdx;
            else if (sourceIdx < targetIdx && i >= sourceIdx && i < targetIdx) oldIdx = i + 1;
            else if (sourceIdx > targetIdx && i > targetIdx && i <= sourceIdx) oldIdx = i - 1;

            const oldTop = firstTops[oldIdx] ?? tr.getBoundingClientRect().top;
            const newTop = tr.getBoundingClientRect().top;
            const deltaY = oldTop - newTop;

            if (Math.abs(deltaY) > 0.5) {
              tr.style.transform = `translateY(${deltaY}px)`;
              tr.style.transition = 'none';
              tr.style.willChange = 'transform';
              if (i === targetIdx) tr.style.zIndex = '30';
            }
          });

          requestAnimationFrame(() => {
            updatedTrs.forEach((tr) => {
              tr.style.transition = `transform ${duration} ${springEase}`;
              tr.style.transform = '';
            });

            setTimeout(() => {
              updatedTrs.forEach((tr) => {
                tr.style.transition = '';
                tr.style.willChange = '';
                tr.style.zIndex = '';
              });
            }, 400);
          });
        });
      });
    } else {
      handleReorderRows(sourceIdx, targetIdx);
    }
  };

  const handleRowDragEnd = () => {
    setDraggedRowIdx(null);
    setDragOverRowIdx(null);
  };

  const handleColDragStart = (e: React.DragEvent, colIdx: number) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', `col:${colIdx}`);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColIdx(colIdx);
    setDragOverColIdx(colIdx);
  };

  const handleColDragOver = (e: React.DragEvent, colIdx: number) => {
    if (draggedColIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColIdx !== colIdx) {
      setDragOverColIdx(colIdx);
    }
  };

  // FLIP animation on drop: smoothly glides the specific column to its final position
  const handleColDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIdx = draggedColIdx;
    setDraggedColIdx(null);
    setDragOverColIdx(null);

    if (sourceIdx === null || sourceIdx === targetIdx) return;

    if (tableElementRef.current) {
      const thElements = Array.from(tableElementRef.current.querySelectorAll('thead th')) as HTMLElement[];
      const firstLefts = thElements.map((th) => th.getBoundingClientRect().left);

      handleReorderCols(sourceIdx, targetIdx);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!tableElementRef.current) return;
          const updatedThs = Array.from(tableElementRef.current.querySelectorAll('thead th')) as HTMLElement[];
          const rows = Array.from(tableElementRef.current.querySelectorAll('tbody tr')) as HTMLElement[];

          const springEase = 'cubic-bezier(0.16, 1, 0.3, 1)';
          const duration = '0.36s';

          const colDeltas: number[] = [];
          updatedThs.forEach((th, i) => {
            let oldIdx = i;
            if (i === targetIdx) oldIdx = sourceIdx;
            else if (sourceIdx < targetIdx && i >= sourceIdx && i < targetIdx) oldIdx = i + 1;
            else if (sourceIdx > targetIdx && i > targetIdx && i <= sourceIdx) oldIdx = i - 1;

            const oldLeft = firstLefts[oldIdx] ?? th.getBoundingClientRect().left;
            const newLeft = th.getBoundingClientRect().left;
            const deltaX = oldLeft - newLeft;
            colDeltas.push(deltaX);

            if (Math.abs(deltaX) > 0.5) {
              th.style.transform = `translateX(${deltaX}px)`;
              th.style.transition = 'none';
              th.style.willChange = 'transform';
              if (i === targetIdx) th.style.zIndex = '30';
            }
          });

          rows.forEach((tr) => {
            const tds = Array.from(tr.querySelectorAll('td')) as HTMLElement[];
            tds.forEach((td, colI) => {
              const deltaX = colDeltas[colI] || 0;
              if (Math.abs(deltaX) > 0.5) {
                td.style.transform = `translateX(${deltaX}px)`;
                td.style.transition = 'none';
                td.style.willChange = 'transform';
                if (colI === targetIdx) td.style.zIndex = '25';
              }
            });
          });

          requestAnimationFrame(() => {
            updatedThs.forEach((th) => {
              th.style.transition = `transform ${duration} ${springEase}`;
              th.style.transform = '';
            });

            rows.forEach((tr) => {
              const tds = Array.from(tr.querySelectorAll('td')) as HTMLElement[];
              tds.forEach((td) => {
                td.style.transition = `transform ${duration} ${springEase}`;
                td.style.transform = '';
              });
            });

            setTimeout(() => {
              updatedThs.forEach((th) => {
                th.style.transition = '';
                th.style.willChange = '';
                th.style.zIndex = '';
              });
              rows.forEach((tr) => {
                const tds = Array.from(tr.querySelectorAll('td')) as HTMLElement[];
                tds.forEach((td) => {
                  td.style.transition = '';
                  td.style.willChange = '';
                  td.style.zIndex = '';
                });
              });
            }, 400);
          });
        });
      });
    } else {
      handleReorderCols(sourceIdx, targetIdx);
    }
  };

  const handleColDragEnd = () => {
    setDraggedColIdx(null);
    setDragOverColIdx(null);
  };

  useEffect(() => {
    if (draggedRowIdx === null && draggedColIdx === null) return;
    const handleGlobalDragEnd = () => {
      setDraggedRowIdx(null);
      setDragOverRowIdx(null);
      setDraggedColIdx(null);
      setDragOverColIdx(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('mouseup', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('mouseup', handleGlobalDragEnd);
    };
  }, [draggedRowIdx, draggedColIdx]);

  // Close table cell context menu on outside click or escape
  useEffect(() => {
    if (!cellContextMenu) return;
    const handleClose = (e: MouseEvent | PointerEvent) => {
      // Ignore right-click button release so it doesn't dismiss the newly opened menu
      if ('button' in e && e.button === 2) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.table-cell-context-menu')) return;
      setCellContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCellContextMenu(null);
    };
    // Delay outside listener attachment slightly so the opening gesture doesn't dismiss it
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }, 60);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cellContextMenu]);

  // Open Table Context Menu
  const openTableContextMenu = (
    e: React.MouseEvent,
    cellKey: string,
    colIdx: number,
    isHeader: boolean,
    rowIdx?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 360;
    const x = Math.min(e.clientX, Math.max(10, window.innerWidth - menuWidth - 12));
    const y = Math.min(e.clientY, Math.max(10, window.innerHeight - menuHeight - 12));
    setCellContextMenu({
      x,
      y,
      cellKey,
      colIdx,
      isHeader,
      rowIdx,
    });
  };

  const handleInsertRowAt = (targetRowIdx: number, above: boolean) => {
    const insertAt = above ? targetRowIdx : targetRowIdx + 1;
    const headers = block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'];
    const currentRows = [...(block.tableRows || [['', '', '']])];
    currentRows.splice(insertAt, 0, new Array(headers.length).fill(''));

    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};
    for (const [key, color] of Object.entries(oldColors)) {
      if (key.startsWith('th-')) {
        newColors[key] = color;
      } else {
        const [rStr, cStr] = key.split('-');
        const r = parseInt(rStr, 10);
        if (r < insertAt) {
          newColors[key] = color;
        } else {
          newColors[`${r + 1}-${cStr}`] = color;
        }
      }
    }
    onUpdateBlock(block.id, { tableRows: currentRows, tableCellColors: newColors });
    setCellContextMenu(null);
  };

  const handleDeleteRowAt = (targetRowIdx: number) => {
    const currentRows = [...(block.tableRows || [['', '', '']])];
    if (currentRows.length <= 1) return;
    currentRows.splice(targetRowIdx, 1);

    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};
    for (const [key, color] of Object.entries(oldColors)) {
      if (key.startsWith('th-')) {
        newColors[key] = color;
      } else {
        const [rStr, cStr] = key.split('-');
        const r = parseInt(rStr, 10);
        if (r < targetRowIdx) {
          newColors[key] = color;
        } else if (r > targetRowIdx) {
          newColors[`${r - 1}-${cStr}`] = color;
        }
      }
    }
    onUpdateBlock(block.id, { tableRows: currentRows, tableCellColors: newColors });
    setCellContextMenu(null);
  };

  const handleInsertColAt = (targetColIdx: number, left: boolean) => {
    const insertAt = left ? targetColIdx : targetColIdx + 1;
    const currentHeaders = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
    currentHeaders.splice(insertAt, 0, `Column ${currentHeaders.length + 1}`);

    const currentRows = (block.tableRows || [['', '', '']]).map((r) => {
      const copy = [...r];
      copy.splice(insertAt, 0, '');
      return copy;
    });

    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};
    for (const [key, color] of Object.entries(oldColors)) {
      if (key.startsWith('th-')) {
        const c = parseInt(key.replace('th-', ''), 10);
        if (c < insertAt) {
          newColors[key] = color;
        } else {
          newColors[`th-${c + 1}`] = color;
        }
      } else {
        const [rStr, cStr] = key.split('-');
        const c = parseInt(cStr, 10);
        if (c < insertAt) {
          newColors[key] = color;
        } else {
          newColors[`${rStr}-${c + 1}`] = color;
        }
      }
    }
    onUpdateBlock(block.id, { tableHeaders: currentHeaders, tableRows: currentRows, tableCellColors: newColors });
    setCellContextMenu(null);
  };

  const handleDeleteColAt = (targetColIdx: number) => {
    const currentHeaders = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
    if (currentHeaders.length <= 1) return;
    currentHeaders.splice(targetColIdx, 1);

    const currentRows = (block.tableRows || [['', '', '']]).map((r) => {
      const copy = [...r];
      copy.splice(targetColIdx, 1);
      return copy;
    });

    const oldColors = block.tableCellColors || {};
    const newColors: Record<string, string> = {};
    for (const [key, color] of Object.entries(oldColors)) {
      if (key.startsWith('th-')) {
        const c = parseInt(key.replace('th-', ''), 10);
        if (c < targetColIdx) {
          newColors[key] = color;
        } else if (c > targetColIdx) {
          newColors[`th-${c - 1}`] = color;
        }
      } else {
        const [rStr, cStr] = key.split('-');
        const c = parseInt(cStr, 10);
        if (c < targetColIdx) {
          newColors[key] = color;
        } else if (c > targetColIdx) {
          newColors[`${rStr}-${c - 1}`] = color;
        }
      }
    }
    onUpdateBlock(block.id, { tableHeaders: currentHeaders, tableRows: currentRows, tableCellColors: newColors });
    setCellContextMenu(null);
  };

  const handleClearCellContent = (cellKey: string, isHeader: boolean, rowIdx?: number, colIdx?: number) => {
    if (isHeader && colIdx !== undefined) {
      const headers = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
      headers[colIdx] = '';
      onUpdateBlock(block.id, { tableHeaders: headers });
    } else if (rowIdx !== undefined && colIdx !== undefined) {
      const rows = (block.tableRows || []).map((r, ri) =>
        ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? '' : c)) : [...r]
      );
      onUpdateBlock(block.id, { tableRows: rows });
    }
    setCellContextMenu(null);
  };

  // 4 Assorted colors for table cell highlighting (Color 1 is the primary Theme Tint matching the top header row)
  const TABLE_CELL_PALETTE = [
    {
      id: 'theme',
      name: 'Theme Tint',
      dotColor: effectiveThemeColor,
      style: {
        backgroundColor: darkMode ? `${effectiveThemeColor}2e` : `${effectiveThemeColor}1f`,
        borderColor: `${effectiveThemeColor}66`,
        color: effectiveThemeColor,
      },
    },
    {
      id: 'amber',
      name: 'Warm Gold',
      dotColor: '#f59e0b',
      style: {
        backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.16)',
        borderColor: 'rgba(245, 158, 11, 0.5)',
        color: darkMode ? '#fef08a' : '#92400e',
      },
    },
    {
      id: 'cyan',
      name: 'Ice Cyan',
      dotColor: '#06b6d4',
      style: {
        backgroundColor: darkMode ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.16)',
        borderColor: 'rgba(6, 182, 212, 0.5)',
        color: darkMode ? '#a5f3fc' : '#0e7490',
      },
    },
    {
      id: 'rose',
      name: 'Vibrant Rose',
      dotColor: '#f43f5e',
      style: {
        backgroundColor: darkMode ? 'rgba(244, 63, 94, 0.22)' : 'rgba(244, 63, 94, 0.16)',
        borderColor: 'rgba(244, 63, 94, 0.5)',
        color: darkMode ? '#fecdd3' : '#9f1239',
      },
    },
  ];

  const getCustomCellStyle = (cellKey: string, isHeader: boolean) => {
    const colorId = (block.tableCellColors || {})[cellKey];
    if (colorId) {
      const match = TABLE_CELL_PALETTE.find((p) => p.id === colorId);
      if (match) return match.style;
    }
    if (isHeader) {
      return TABLE_CELL_PALETTE[0].style;
    }
    return undefined;
  };

  const sideFileInputRef = useRef<HTMLInputElement>(null);
  const [isEnteringSideUrl, setIsEnteringSideUrl] = useState(false);
  const [sideUrlInput, setSideUrlInput] = useState('');
  const [sideImageFitCover, setSideImageFitCover] = useState(true);

  // Handle companion image upload from local disk as Base64 data URL
  const handleSideFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onUpdateBlock(block.id, { sideImageUrl: result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplySideUrl = () => {
    if (sideUrlInput.trim()) {
      onUpdateBlock(block.id, { sideImageUrl: sideUrlInput.trim() });
      setSideUrlInput('');
      setIsEnteringSideUrl(false);
    }
  };

  const handleSwapSides = () => {
    setIsSwapping(true);
    onUpdateBlock(block.id, {
      sideMode: block.sideMode === 'left' ? 'right' : 'left',
    });
    setTimeout(() => {
      setIsSwapping(false);
    }, 450);
  };

  // Maximum minimizing resize thresholds (stops shrinking when image fits tile without bezels)
  const MIN_TILE_WIDTH_PX = 340;
  const MIN_TILE_HEIGHT_PX = 240;

  const isParallel = Boolean(block.sideMode && block.sideMode !== 'none');
  const effectiveWidth = isParallel
    ? Math.min(68, Math.max(32, liveWidth ?? (block.width && block.width < 90 ? block.width : 50)))
    : (liveWidth ?? block.width ?? 100);
  const effectiveHeight = liveHeight ?? block.height ?? 340;

  // Close parallel dropdown on outside click
  useEffect(() => {
    if (!isParallelMenuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (parallelMenuRef.current && !parallelMenuRef.current.contains(e.target as Node)) {
        setIsParallelMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isParallelMenuOpen]);

  // Handle image upload from local disk as Base64 data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onUpdateBlock(block.id, { imageUrl: result });
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onUpdateBlock(block.id, { imageUrl: urlInput.trim() });
      setUrlInput('');
      setIsEnteringUrl(false);
    }
  };

  // Ultra-optimized, zero-lag horizontal drag-to-resize handler with requestAnimationFrame
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const startX = e.clientX;
    const containerRect = container.getBoundingClientRect();
    const initialWidth = isParallel
      ? Math.min(68, Math.max(32, block.width && block.width < 90 ? block.width : 50))
      : (block.width || 100);
    let latestWidth = initialWidth;
    let rAFId: number | null = null;

    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      const adjustedDelta = block.sideMode === 'right' ? -deltaPercent : deltaPercent;
      latestWidth = isParallel
        ? Math.min(68, Math.max(32, Math.round(initialWidth + adjustedDelta)))
        : Math.min(100, Math.max(34, Math.round(initialWidth + adjustedDelta)));

      if (rAFId !== null) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        setLiveWidth(latestWidth);
      });
    };

    const handleMouseUp = () => {
      if (rAFId !== null) cancelAnimationFrame(rAFId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizing(false);
      setLiveWidth(null);
      onUpdateBlock(block.id, { width: latestWidth });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Ultra-optimized, zero-lag vertical drag-to-resize handler with requestAnimationFrame
  const handleVerticalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const initialHeight = block.height || 340;
    let latestHeight = initialHeight;
    let rAFId: number | null = null;

    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      latestHeight = Math.min(900, Math.max(MIN_TILE_HEIGHT_PX, Math.round(initialHeight + deltaY)));

      if (rAFId !== null) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        setLiveHeight(latestHeight);
      });
    };

    const handleMouseUp = () => {
      if (rAFId !== null) cancelAnimationFrame(rAFId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizing(false);
      setLiveHeight(null);
      onUpdateBlock(block.id, { height: latestHeight });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Ultra-optimized, zero-lag diagonal corner drag-to-resize handler (width & height simultaneously)
  const handleCornerResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const containerRect = container.getBoundingClientRect();
    const initialWidth = isParallel
      ? Math.min(68, Math.max(32, block.width && block.width < 90 ? block.width : 50))
      : (block.width || 100);
    const initialHeight = block.height || 340;
    let latestWidth = initialWidth;
    let latestHeight = initialHeight;
    let rAFId: number | null = null;

    setIsResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'se-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      latestWidth = isParallel
        ? Math.min(68, Math.max(32, Math.round(initialWidth + deltaPercent)))
        : Math.min(100, Math.max(34, Math.round(initialWidth + deltaPercent)));
      latestHeight = Math.min(900, Math.max(MIN_TILE_HEIGHT_PX, Math.round(initialHeight + deltaY)));

      if (rAFId !== null) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        setLiveWidth(latestWidth);
        setLiveHeight(latestHeight);
      });
    };

    const handleMouseUp = () => {
      if (rAFId !== null) cancelAnimationFrame(rAFId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizing(false);
      setLiveWidth(null);
      setLiveHeight(null);
      onUpdateBlock(block.id, { width: latestWidth, height: latestHeight });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // All block types that can be paired in parallel with the image tile
  const PARALLEL_OPTIONS: {
    type: BlockType;
    label: string;
    shortLabel: string;
    Icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    placeholder: string;
  }[] = [
    {
      type: 'image',
      label: 'Image / Diagram',
      shortLabel: 'Image',
      Icon: ImageIcon,
      colorClass: 'text-cyan-400',
      placeholder: 'Secondary diagram, comparison figure, or parallel architecture...',
    },
    {
      type: 'code',
      label: 'Code Block',
      shortLabel: 'Code',
      Icon: Code2,
      colorClass: 'text-purple-400',
      placeholder: '# Implementation parallel to diagram...\ndef forward(q, k, v):\n    scores = torch.matmul(q, k.transpose(-2, -1))\n    return F.softmax(scores, dim=-1) @ v',
    },
    {
      type: 'paragraph',
      label: 'Text',
      shortLabel: 'Text',
      Icon: Type,
      colorClass: 'text-blue-400',
      placeholder: 'Enter notes, explanations, or architectural walkthrough beside diagram...',
    },
    {
      type: 'todo',
      label: 'To-Do',
      shortLabel: 'To-Do',
      Icon: CheckSquare,
      colorClass: 'text-emerald-400',
      placeholder: 'Action item or milestone related to diagram...',
    },
    {
      type: 'callout',
      label: 'Callout',
      shortLabel: 'Callout',
      Icon: AlertCircle,
      colorClass: 'text-amber-400',
      placeholder: 'Key takeaway, architectural warning, or important insight...',
    },
    {
      type: 'quote',
      label: 'Quote',
      shortLabel: 'Quote',
      Icon: Quote,
      colorClass: 'text-rose-400',
      placeholder: 'Quotation, theorem citation, or design principle...',
    },
    {
      type: 'h1',
      label: 'Heading 1',
      shortLabel: 'H1',
      Icon: Heading1,
      colorClass: 'text-amber-400',
      placeholder: 'Primary Section Title...',
    },
    {
      type: 'h2',
      label: 'Heading 2',
      shortLabel: 'H2',
      Icon: Heading2,
      colorClass: 'text-amber-400',
      placeholder: 'Secondary Section Title...',
    },
    {
      type: 'math',
      label: 'Math Equation',
      shortLabel: 'Math',
      Icon: Sigma,
      colorClass: 'text-violet-400',
      placeholder: '\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V',
    },
  ];

  const handleSelectParallelOption = (optionType: BlockType) => {
    const isCurrentParallel = block.sideMode && block.sideMode !== 'none';
    onUpdateBlock(block.id, {
      sideMode: isCurrentParallel ? block.sideMode : 'left',
      sideBlockType: optionType,
      width: block.width && block.width <= 70 ? block.width : 50,
      height: block.height || 340,
      sideCodeLanguage: block.sideCodeLanguage || 'python',
      sideImageUrl: block.sideImageUrl || (optionType === 'image' ? '/assets/aistudio/image_43eecb83.png' : undefined),
    });
    setIsParallelMenuOpen(false);
  };

  // Render the core Image Tile card
  const renderImageTileCard = () => {
    const activeCompanionType = block.sideBlockType || 'code';
    const currentCompanionOption =
      PARALLEL_OPTIONS.find((opt) => opt.type === activeCompanionType) || PARALLEL_OPTIONS[0];

    return (
      <div
        className={`liquid-glass-tile rounded-2xl border shadow-lg backdrop-blur-xl relative flex flex-col ${
          isResizing ? '' : 'transition-all duration-150'
        } ${
          darkMode
            ? 'bg-slate-900/70 border-cyan-500/30 shadow-cyan-950/20'
            : 'bg-white/85 border-cyan-400/40 shadow-slate-300/40'
        }`}
        style={{
          transition: isResizing ? 'none' : undefined,
          willChange: isResizing ? 'width, height' : undefined,
        }}
      >
        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Top Header: Image Icon on left + Editable Description / Title + Standalone button in parallel mode */}
        <div
          className={`px-3.5 py-2 border-b rounded-t-2xl flex items-center justify-between gap-2 select-none relative z-30 transition-colors ${
            darkMode
              ? 'bg-slate-950/60 border-cyan-500/20 text-slate-300'
              : 'bg-cyan-50/70 border-cyan-200/60 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) => onUpdateBlock(block.id, { caption: e.target.value })}
              placeholder="Add image title or architectural description..."
              className={`bg-transparent text-xs font-medium focus:outline-none focus:ring-1 focus:ring-cyan-400/40 rounded px-1.5 py-0.5 w-full max-w-md transition ${
                darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Standalone Button (visible in parallel mode: keeps this main block and removes companion) */}
          {isParallel && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateBlock(block.id, { sideMode: 'none', width: 100 })}
                className={`px-2 py-0.5 rounded text-[10px] font-sans transition flex items-center gap-1 active:scale-95 ${
                  darkMode
                    ? 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                    : 'bg-black/5 hover:bg-black/10 text-slate-700 hover:text-slate-900'
                }`}
                title="Keep this image block as standalone and remove parallel companion"
              >
                <Maximize2 className="w-3 h-3 opacity-70" />
                <span>Standalone</span>
              </button>
            </div>
          )}
        </div>

        {/* Web URL Input Drawer */}
        {isEnteringUrl && (
          <div className="p-2 border-b border-white/10 bg-slate-950/80 flex items-center gap-2 text-xs">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
              placeholder="Paste image URL (https://...)"
              className="flex-1 bg-transparent px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs transition"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setIsEnteringUrl(false)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Image Content Body (Bezel-free edge-to-edge layout) */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden rounded-b-2xl relative">
          {block.imageUrl ? (
            <div className="flex-1 flex flex-col justify-between w-full h-full relative">
              <div
                className={`relative group/img overflow-hidden w-full flex items-center justify-center bg-black/10 ${
                  isResizing ? '' : 'transition-all'
                }`}
                style={{
                  height: `${effectiveHeight}px`,
                  maxHeight: `${effectiveHeight}px`,
                  transition: isResizing ? 'none' : undefined,
                }}
              >
                <img
                  src={block.imageUrl}
                  alt={block.caption || 'Inserted diagram'}
                  draggable={false}
                  className={`w-full h-full ${
                    imageFitCover ? 'object-cover' : 'object-contain'
                  } select-none pointer-events-none transition-all duration-200`}
                  onError={() => {
                    // Fallback to sample diagram if URL failed
                    onUpdateBlock(block.id, { imageUrl: '/assets/aistudio/image_0b4c09c1.png' });
                  }}
                />

                {/* Hover overlay quick buttons (Icon-only: Bezel icon, Split/Parallel toggle icon, Trash icon) */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-85 md:opacity-0 md:group-hover/img:opacity-100 transition-opacity bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-xl z-10">
                  {/* 1. Bezel Icon (Icon-only) */}
                  <button
                    type="button"
                    onClick={() => setImageFitCover(!imageFitCover)}
                    className="p-1.5 hover:text-cyan-400 text-slate-300 hover:bg-white/10 rounded-md transition"
                    title={imageFitCover ? 'Contain (Full diagram)' : 'Fill (No bezels)'}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 2. Split / Parallel Toggle Icon (replaces the replace button, icon-only) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isParallel) {
                        onUpdateBlock(block.id, { sideMode: 'none', width: 100 });
                      } else {
                        onUpdateBlock(block.id, {
                          sideMode: 'left',
                          sideBlockType: block.sideBlockType || 'code',
                          width: 50,
                          height: block.height || 340,
                        });
                      }
                    }}
                    className={`p-1.5 rounded-md transition ${
                      isParallel
                        ? 'bg-cyan-500/25 text-cyan-300 shadow-sm'
                        : 'text-slate-300 hover:text-cyan-400 hover:bg-white/10'
                    }`}
                    title={isParallel ? 'Turn off parallel mode (return to standalone)' : 'Turn on parallel mode'}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>

                  {/* 3. Trash Icon (Icon-only, returns to lander) */}
                  <button
                    type="button"
                    onClick={() => onUpdateBlock(block.id, { imageUrl: '' })}
                    className="p-1.5 hover:text-red-400 text-slate-400 hover:bg-red-500/10 rounded-md transition"
                    title="Remove image (return to lander)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State / Dropzone with Sample Diagram Presets */
            <div className="p-3">
              <div
                className="p-6 sm:p-8 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 transition-colors flex flex-col items-center justify-center gap-3 text-center bg-cyan-500/[0.03]"
                style={{
                  minHeight: `${Math.min(effectiveHeight, 240)}px`,
                }}
              >
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-cyan-300">
                    Select or upload an image diagram
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports local files (PNG, JPG, SVG, WebP) or web image URLs
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose Image File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEnteringUrl(true)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs flex items-center gap-1.5 transition"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Paste URL</span>
                  </button>
                </div>

                {/* Sample Architecture Diagram Chips */}
                <div className="pt-2 border-t border-white/5 w-full flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Quick Sample Diagrams:
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBlock(block.id, {
                          imageUrl: '/assets/aistudio/image_0b4c09c1.png',
                          caption: 'Figure 1: Multi-Head Attention Architecture',
                        })
                      }
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] transition"
                    >
                      🧠 Attention Schematic
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBlock(block.id, {
                          imageUrl: '/assets/aistudio/image_43eecb83.png',
                          caption: 'Figure 2: Pipeline Data Flowchart',
                        })
                      }
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] transition"
                    >
                      📊 Data Flowchart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Bottom Drag Resizer Handle */}
        <div
          onMouseDown={handleVerticalResizeMouseDown}
          className={`w-full h-3.5 cursor-row-resize flex items-center justify-center select-none group/rowresizer border-t border-white/5 ${
            isResizing ? 'bg-cyan-500/20' : 'hover:bg-cyan-500/15 transition-colors'
          }`}
          title="Drag up or down to resize vertically"
        >
          <div
            className={`rounded-full shadow-sm ${
              isResizing
                ? 'w-20 h-1.5 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
                : 'w-12 h-1 bg-cyan-400/40 group-hover/rowresizer:bg-cyan-400 group-hover/rowresizer:w-16 transition-all'
            }`}
          />
        </div>

        {/* Corner Diagonal Drag Resizer Handle */}
        <div
          onMouseDown={handleCornerResizeMouseDown}
          className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-20 select-none ${
            isResizing ? 'text-cyan-300 scale-125' : 'text-cyan-400/40 hover:text-cyan-300 transition-colors'
          }`}
          title="Drag diagonally to resize width and height simultaneously"
        >
          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 16 16">
            <path d="M14 14H10V12H12V10H14V14ZM14 8H12V6H14V8ZM8 14H6V12H8V14Z" opacity="0.8" />
          </svg>
        </div>
      </div>
    );
  };

  // Render the parallel companion block with authentic native OneNote styling for each block type
  const renderParallelCompanionCard = () => {
    const companionType = block.sideBlockType || 'code';
    const companionMeta =
      PARALLEL_OPTIONS.find((opt) => opt.type === companionType) || PARALLEL_OPTIONS[0];
    const CompanionIcon = companionMeta.Icon;
    const companionLangTheme = getLanguageTheme(block.sideCodeLanguage || 'python');

    // Distinct container backgrounds and borders per block type so text/headings look native rather than like code IDEs
    const containerStyleMap: Record<string, string> = {
      image: darkMode
        ? 'border-cyan-500/25 bg-slate-900/80 text-slate-100 shadow-xl shadow-cyan-950/20'
        : 'border-cyan-300 bg-white/95 text-slate-800 shadow-slate-300/40',
      code: darkMode
        ? 'border-slate-700/80 bg-[#141722] text-slate-100 shadow-xl shadow-black/40'
        : 'border-slate-300 bg-white text-slate-900 shadow-slate-200/50',
      paragraph: darkMode
        ? 'border-white/10 bg-slate-900/40 text-slate-100 shadow-md'
        : 'border-slate-200 bg-white/95 text-slate-800 shadow-slate-300/40',
      h1: darkMode
        ? 'border-amber-500/25 bg-amber-500/[0.04] text-slate-100 shadow-md'
        : 'border-amber-300/70 bg-amber-50/60 text-slate-900 shadow-amber-500/10',
      h2: darkMode
        ? 'border-amber-500/20 bg-amber-500/[0.025] text-slate-100 shadow-md'
        : 'border-slate-200 bg-white/90 text-slate-900 shadow-slate-200/50',
      todo: darkMode
        ? 'border-emerald-500/25 bg-emerald-950/20 text-slate-100 shadow-md'
        : 'border-emerald-200/90 bg-emerald-50/60 text-slate-900 shadow-emerald-500/10',
      callout: darkMode
        ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent text-amber-100 shadow-md shadow-amber-950/20'
        : 'border-amber-300 bg-gradient-to-br from-amber-100/90 via-amber-50/80 to-white text-amber-950 shadow-amber-200/40',
      quote: darkMode
        ? 'border-rose-500/25 bg-gradient-to-br from-rose-950/25 via-rose-950/10 to-transparent text-rose-100 shadow-md'
        : 'border-rose-200 bg-gradient-to-br from-rose-100/70 via-rose-50/60 to-white text-slate-800 shadow-rose-200/40',
      math: darkMode
        ? 'border-violet-500/25 bg-[#141722] text-slate-100 shadow-xl shadow-black/40'
        : 'border-violet-200 bg-white text-slate-900 shadow-violet-100/50',
    };
    const containerClasses =
      containerStyleMap[companionType] ||
      (darkMode ? 'border-white/10 bg-slate-900/50' : 'border-slate-200 bg-white/90');

    // To-Do items multi-line interactive checklist parser
    const todoRawLines = (block.sideContent || '')
      .split('\n')
      .filter((line, idx, arr) => line.trim().length > 0 || (idx === 0 && arr.length === 1));

    const todoItems = todoRawLines.length > 0
      ? todoRawLines.map((line) => {
          const isChecked = line.startsWith('[x] ') || line.startsWith('[X] ');
          const text = line.replace(/^\[[ xX]\]\s*/, '');
          return { checked: isChecked, text };
        })
      : [{ checked: !!block.sideChecked, text: '' }];

    const completedTodoCount = todoItems.filter((item) => item.checked).length;

    const handleToggleTodoItem = (index: number) => {
      const updated = todoItems.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      );
      const serialized = updated.map((it) => `[${it.checked ? 'x' : ' '}] ${it.text}`).join('\n');
      onUpdateBlock(block.id, {
        sideContent: serialized,
        sideChecked: updated.some((it) => it.checked),
      });
    };

    const handleUpdateTodoText = (index: number, newText: string) => {
      const updated = todoItems.map((item, i) =>
        i === index ? { ...item, text: newText } : item
      );
      const serialized = updated.map((it) => `[${it.checked ? 'x' : ' '}] ${it.text}`).join('\n');
      onUpdateBlock(block.id, { sideContent: serialized });
    };

    const handleAddTodoItem = () => {
      const updated = [...todoItems, { checked: false, text: '' }];
      const serialized = updated.map((it) => `[${it.checked ? 'x' : ' '}] ${it.text}`).join('\n');
      onUpdateBlock(block.id, { sideContent: serialized });
    };

    const handleDeleteTodoItem = (index: number) => {
      if (todoItems.length <= 1) {
        onUpdateBlock(block.id, { sideContent: '' });
        return;
      }
      const updated = todoItems.filter((_, i) => i !== index);
      const serialized = updated.map((it) => `[${it.checked ? 'x' : ' '}] ${it.text}`).join('\n');
      onUpdateBlock(block.id, { sideContent: serialized });
    };

    // Keep companion block as standalone while removing the main image block
    const handleKeepCompanionStandalone = () => {
      if (block.sideBlockType === 'image') {
        onUpdateBlock(block.id, {
          imageUrl: block.sideImageUrl || block.imageUrl,
          caption: block.sideCaption || block.sideBlockName || block.caption,
          sideMode: 'none',
          width: 100,
          sideImageUrl: '',
          sideCaption: '',
          sideBlockName: '',
        });
      } else {
        onUpdateBlock(block.id, {
          type: block.sideBlockType || 'code',
          content: block.sideCodeContent || block.sideContent || '',
          language: block.sideCodeLanguage || 'python',
          sideMode: 'none',
          width: 100,
          sideContent: '',
          sideCodeContent: '',
          imageUrl: '',
          caption: '',
        });
      }
    };

    // Shared top controls for companion blocks (Standalone button: keeps this companion block)
    const renderCompanionControls = () => (
      <div className="flex items-center gap-1.5 shrink-0 select-none">
        <button
          type="button"
          onClick={handleKeepCompanionStandalone}
          className={`px-2 py-0.5 rounded text-[10px] font-sans transition flex items-center gap-1 active:scale-95 ${
            darkMode
              ? 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
              : 'bg-black/5 hover:bg-black/10 text-slate-700 hover:text-slate-900'
          }`}
          title="Keep this companion block as standalone and remove the parallel image"
        >
          <Maximize2 className="w-3 h-3 opacity-70" />
          <span>Standalone</span>
        </button>
      </div>
    );

    return (
      <div
        className={`liquid-glass-tile rounded-2xl border flex flex-col h-full backdrop-blur-xl transition-all duration-150 overflow-hidden ${containerClasses}`}
        style={{
          minHeight: `${effectiveHeight}px`,
          transition: isResizing ? 'none' : undefined,
          willChange: isResizing ? 'height' : undefined,
        }}
      >
        {/* 1. CODE BLOCK COMPANION (OneNote Palette & VS Code Syntax Highlighting) */}
        {companionType === 'code' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <CodeEditor
              value={block.sideCodeContent || block.sideContent || ''}
              onChange={(val) => onUpdateBlock(block.id, { sideCodeContent: val })}
              language={block.sideCodeLanguage || 'python'}
              onLanguageChange={(lang) => onUpdateBlock(block.id, { sideCodeLanguage: lang })}
              darkMode={darkMode}
              themeColor={effectiveThemeColor}
              headerActions={renderCompanionControls()}
              isCompanion={true}
              minHeight={200}
            />
          </div>
        )}

        {/* 2. TEXT / PARAGRAPH COMPANION (Authentic Note Canvas) */}
        {companionType === 'paragraph' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
                <Type className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Document Note'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Document Note"
                  title="Click to edit block name"
                  className="bg-transparent font-medium text-xs text-blue-400 focus:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            <textarea
              rows={Math.max(6, (block.sideContent || '').split('\n').length)}
              value={block.sideContent || ''}
              onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
              placeholder={companionMeta.placeholder}
              className={`flex-1 w-full text-sm sm:text-base leading-relaxed bg-transparent focus:outline-none resize-none placeholder:opacity-30 min-h-[160px] ${
                darkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
              }`}
            />

            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
              <span>OneNote Page Canvas</span>
              <span>{(block.sideContent || '').length} characters</span>
            </div>
          </div>
        )}

        {/* 3. HEADING 1 COMPANION (Authentic Section Header & Notes) */}
        {companionType === 'h1' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <Heading1 className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Heading 1'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Heading 1"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold uppercase tracking-wider text-xs text-amber-400 focus:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            {/* Bold typographic heading title */}
            <input
              type="text"
              value={block.sideTitle !== undefined ? block.sideTitle : (!block.sideContent || !block.sideContent.includes('\n') ? (block.sideContent || '') : '')}
              onChange={(e) => onUpdateBlock(block.id, { sideTitle: e.target.value })}
              placeholder={companionMeta.placeholder}
              className={`w-full text-xl sm:text-2xl font-bold bg-transparent focus:outline-none border-b border-amber-500/20 pb-2 mb-3 placeholder:opacity-35 ${
                darkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />

            {/* Integrated section body notes */}
            <textarea
              rows={Math.max(4, (block.sideContent || '').split('\n').length)}
              value={block.sideContent || ''}
              onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
              placeholder="Add section breakdown, details, or architectural observations for this diagram..."
              className={`flex-1 w-full text-xs sm:text-sm leading-relaxed bg-transparent focus:outline-none resize-none placeholder:opacity-30 min-h-[120px] ${
                darkMode ? 'text-slate-300 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
              }`}
            />
          </div>
        )}

        {/* 4. HEADING 2 COMPANION (Authentic Sub-section Title & Notes) */}
        {companionType === 'h2' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <Heading2 className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Heading 2'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Heading 2"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold uppercase tracking-wider text-xs text-amber-400 focus:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            {/* Sub-heading title */}
            <input
              type="text"
              value={block.sideTitle !== undefined ? block.sideTitle : (!block.sideContent || !block.sideContent.includes('\n') ? (block.sideContent || '') : '')}
              onChange={(e) => onUpdateBlock(block.id, { sideTitle: e.target.value })}
              placeholder={companionMeta.placeholder}
              className={`w-full text-lg sm:text-xl font-semibold bg-transparent focus:outline-none border-b border-amber-500/15 pb-1.5 mb-2.5 placeholder:opacity-35 ${
                darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
              }`}
            />

            {/* Integrated subsection notes */}
            <textarea
              rows={Math.max(4, (block.sideContent || '').split('\n').length)}
              value={block.sideContent || ''}
              onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
              placeholder="Add subsection context, details, or notes..."
              className={`flex-1 w-full text-xs sm:text-sm leading-relaxed bg-transparent focus:outline-none resize-none placeholder:opacity-30 min-h-[120px] ${
                darkMode ? 'text-slate-300 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
              }`}
            />
          </div>
        )}

        {/* 5. TO-DO COMPANION (Interactive Multi-item Checklist Panel) */}
        {companionType === 'todo' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'To-Do Checklist'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="To-Do Checklist"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold text-xs text-emerald-400 focus:text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
                {todoItems.length > 0 && todoItems[0].text && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-mono">
                    {completedTodoCount}/{todoItems.length}
                  </span>
                )}
              </div>
              {renderCompanionControls()}
            </div>

            {/* Checklist items list */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar py-1">
              {todoItems.map((item, idx) => (
                <div
                  key={idx}
                  className="group/item flex items-center gap-2.5 p-1 rounded-lg transition-colors hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTodoItem(idx)}
                    className="text-emerald-500 hover:text-emerald-400 shrink-0 transition"
                  >
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 fill-emerald-500/20 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => handleUpdateTodoText(idx, e.target.value)}
                    placeholder={idx === 0 ? companionMeta.placeholder : 'Next action item...'}
                    className={`flex-1 text-xs sm:text-sm bg-transparent focus:outline-none placeholder:opacity-30 ${
                      item.checked
                        ? 'line-through text-slate-500'
                        : darkMode
                        ? 'text-slate-100 placeholder:text-slate-500'
                        : 'text-slate-800 placeholder:text-slate-400'
                    }`}
                  />

                  {todoItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTodoItem(idx)}
                      className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add item button */}
              <button
                type="button"
                onClick={handleAddTodoItem}
                className="mt-2 self-start flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-medium transition"
              >
                <Plus className="w-3 h-3" />
                <span>Add Checklist Item</span>
              </button>
            </div>
          </div>
        )}

        {/* 6. CALLOUT COMPANION (Authentic OneNote Highlight Card) */}
        {companionType === 'callout' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold tracking-wide">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Callout Note'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Callout Note"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold text-xs text-amber-400 focus:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            {/* Callout Header with Icon & Title */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={block.sideTitle !== undefined ? block.sideTitle : ''}
                onChange={(e) => onUpdateBlock(block.id, { sideTitle: e.target.value })}
                placeholder="Important Insight / Key Takeaway..."
                className="flex-1 font-bold text-sm sm:text-base text-amber-200 bg-transparent focus:outline-none placeholder:text-amber-300/30"
              />
            </div>

            {/* Callout Description Textarea */}
            <textarea
              rows={Math.max(4, (block.sideContent || '').split('\n').length)}
              value={block.sideContent || ''}
              onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
              placeholder={companionMeta.placeholder}
              className="flex-1 w-full text-xs sm:text-sm leading-relaxed text-amber-100 placeholder:text-amber-200/35 bg-transparent focus:outline-none resize-none min-h-[120px]"
            />
          </div>
        )}

        {/* 7. QUOTE COMPANION (Authentic Blockquote & Citation) */}
        {companionType === 'quote' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full relative overflow-hidden">
            {/* Watermark Quote Character in Background */}
            <span className="absolute right-4 top-2 text-7xl font-serif select-none pointer-events-none opacity-10 text-rose-300">
              “
            </span>

            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold tracking-wide">
                <Quote className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Quote & Citation'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Quote & Citation"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold text-xs text-rose-400 focus:text-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            {/* Blockquote with left accent border */}
            <div className="border-l-4 border-rose-500/80 pl-4 py-1 flex-1 flex flex-col justify-center relative z-10">
              <textarea
                rows={Math.max(4, (block.sideContent || '').split('\n').length)}
                value={block.sideContent || ''}
                onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
                placeholder={companionMeta.placeholder}
                className={`w-full text-sm sm:text-base italic font-serif leading-relaxed bg-transparent focus:outline-none resize-none flex-1 min-h-[100px] ${
                  darkMode ? 'text-rose-100 placeholder:text-rose-300/35' : 'text-slate-800 placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* Attribution Input at Bottom */}
            <div className="flex items-center gap-2 pt-3 border-t border-rose-500/15 text-xs text-rose-300/80 relative z-10">
              <span className="font-serif select-none text-base">—</span>
              <input
                type="text"
                value={block.sideCitation !== undefined ? block.sideCitation : ''}
                onChange={(e) => onUpdateBlock(block.id, { sideCitation: e.target.value })}
                placeholder="Author, paper, or theorem attribution..."
                className="flex-1 bg-transparent focus:outline-none font-sans text-xs text-rose-200 placeholder:text-rose-300/30"
              />
            </div>
          </div>
        )}

        {/* 8. IMAGE COMPANION (Parallel Dual-Image / Diagram Comparison) */}
        {companionType === 'image' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden relative rounded-2xl">
            {/* Hidden File Input for Side Image Upload */}
            <input
              ref={sideFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSideFileUpload}
              className="hidden"
            />

            {/* Side Image Top Bar: Identical layout to main image tile with ImageIcon + editable title, and companion controls on the right */}
            <div
              className={`px-3.5 py-2 border-b rounded-t-2xl flex items-center justify-between gap-2 select-none relative z-30 transition-colors ${
                darkMode
                  ? 'bg-slate-950/60 border-cyan-500/20 text-slate-300'
                  : 'bg-cyan-50/70 border-cyan-200/60 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={block.sideCaption || block.sideBlockName || ''}
                  onChange={(e) =>
                    onUpdateBlock(block.id, {
                      sideCaption: e.target.value,
                      sideBlockName: e.target.value,
                    })
                  }
                  placeholder="Add companion diagram description..."
                  className={`bg-transparent text-xs font-medium focus:outline-none focus:ring-1 focus:ring-cyan-400/40 rounded px-1.5 py-0.5 w-full max-w-md transition ${
                    darkMode
                      ? 'text-slate-200 placeholder:text-slate-500'
                      : 'text-slate-800 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {renderCompanionControls()}
              </div>
            </div>

            {/* Inline URL Input Drawer */}
            {isEnteringSideUrl && (
              <div className="p-2 border-b border-white/10 bg-slate-950/80 flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={sideUrlInput}
                  onChange={(e) => setSideUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplySideUrl()}
                  placeholder="Paste image URL (https://...)"
                  className="flex-1 bg-transparent px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleApplySideUrl}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs transition"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setIsEnteringSideUrl(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Side Image Content Body */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
              {block.sideImageUrl ? (
                <div className="flex-1 flex flex-col justify-between w-full h-full relative">
                  <div
                    className={`relative group/sideimg overflow-hidden w-full flex items-center justify-center bg-black/10 ${
                      isResizing ? '' : 'transition-all'
                    }`}
                    style={{
                      height: `${effectiveHeight}px`,
                      maxHeight: `${effectiveHeight}px`,
                      transition: isResizing ? 'none' : undefined,
                    }}
                  >
                    <img
                      src={block.sideImageUrl}
                      alt={block.sideCaption || 'Parallel diagram'}
                      draggable={false}
                      className={`w-full h-full ${
                        sideImageFitCover ? 'object-cover' : 'object-contain'
                      } select-none pointer-events-none transition-all duration-200`}
                      onError={() => {
                        onUpdateBlock(block.id, { sideImageUrl: '/assets/aistudio/image_43eecb83.png' });
                      }}
                    />

                    {/* Hover overlay quick buttons (Icon-only: Bezel icon, Swap icon, Trash icon) */}
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-85 md:opacity-0 md:group-hover/sideimg:opacity-100 transition-opacity bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-xl z-10">
                      {/* 1. Bezel Icon (Icon-only) */}
                      <button
                        type="button"
                        onClick={() => setSideImageFitCover(!sideImageFitCover)}
                        className="p-1.5 hover:text-cyan-400 text-slate-300 hover:bg-white/10 rounded-md transition"
                        title={sideImageFitCover ? 'Contain (Full diagram)' : 'Fill (No bezels)'}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {/* 2. Swap Columns Icon (Icon-only) */}
                      <button
                        type="button"
                        onClick={handleSwapSides}
                        className={`p-1.5 hover:text-cyan-400 text-slate-300 hover:bg-white/10 rounded-md transition-colors ${
                          isSwapping ? (darkMode ? 'text-white bg-white/15' : 'text-slate-900 bg-black/10') : ''
                        }`}
                        title="Swap parallel column order"
                      >
                        <ArrowLeftRight
                          className={`w-3.5 h-3.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isSwapping ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>

                      {/* 3. Trash Icon (Icon-only, returns to lander) */}
                      <button
                        type="button"
                        onClick={() => onUpdateBlock(block.id, { sideImageUrl: '' })}
                        className="p-1.5 hover:text-red-400 text-slate-400 hover:bg-red-500/10 rounded-md transition"
                        title="Remove companion image (return to lander)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty Dropzone for Side Image — exactly mimics main image dropzone lander */
                <div className="p-3">
                  <div
                    className="p-6 sm:p-8 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 transition-colors flex flex-col items-center justify-center gap-3 text-center bg-cyan-500/[0.03]"
                    style={{
                      minHeight: `${Math.min(effectiveHeight, 240)}px`,
                    }}
                  >
                    <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-cyan-300">
                        Select or upload an image diagram
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Supports local files (PNG, JPG, SVG, WebP) or web image URLs
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => sideFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Image File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEnteringSideUrl(true)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs flex items-center gap-1.5 transition"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Paste URL</span>
                      </button>
                    </div>

                    {/* Quick Sample Diagrams */}
                    <div className="pt-2 border-t border-white/5 w-full flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        Quick Sample Diagrams:
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBlock(block.id, {
                              sideImageUrl: '/assets/aistudio/image_0b4c09c1.png',
                              sideCaption: 'Figure 1: Multi-Head Attention Architecture',
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] transition"
                        >
                          🧠 Attention Schematic
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBlock(block.id, {
                              sideImageUrl: '/assets/aistudio/image_43eecb83.png',
                              sideCaption: 'Figure 2: Pipeline Data Flowchart',
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] transition"
                        >
                          📊 Data Flowchart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. MATH EQUATION COMPANION (Parallel Math with Diagram / Image) */}
        {companionType === 'math' && (
          <div className="flex-1 flex flex-col p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-violet-400 text-xs font-semibold uppercase tracking-wider">
                <Sigma className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Mathematical Formulation'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Mathematical Formulation"
                  title="Click to edit block name"
                  className="bg-transparent font-semibold uppercase tracking-wider text-xs text-violet-400 focus:text-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-400/50 rounded px-1.5 py-0.5 hover:bg-white/5 transition truncate max-w-[140px] sm:max-w-[200px]"
                />
              </div>
              {renderCompanionControls()}
            </div>

            <div className={`p-4 rounded-xl flex items-center justify-center overflow-x-auto my-auto select-text ${
              darkMode ? 'bg-slate-950/40 text-slate-100' : 'bg-slate-50 text-slate-900'
            }`}>
              <div
                className="text-base sm:text-lg"
                dangerouslySetInnerHTML={{
                  __html: renderKatex(
                    normalizeMathExpression(
                      block.sideContent || '\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V'
                    ),
                    true
                  ),
                }}
              />
            </div>

            <div className="mt-3 pt-2.5 border-t border-inherit flex items-center gap-2">
              <span className="font-mono text-[10px] opacity-50 uppercase tracking-wider shrink-0 select-none">
                LaTeX:
              </span>
              <input
                type="text"
                value={block.sideContent || ''}
                onChange={(e) => onUpdateBlock(block.id, { sideContent: e.target.value })}
                placeholder="Formula LaTeX (e.g. Attention(Q, K, V) = Softmax...)"
                className={`flex-1 bg-transparent font-mono text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 rounded px-1.5 py-0.5 ${
                  darkMode ? 'text-violet-300 placeholder:text-slate-600' : 'text-violet-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 1. Enter key: for todo or bullet list, inserts a new todo or bullet block immediately after
    if (e.key === 'Enter' && !e.shiftKey) {
      if (block.type === 'todo') {
        e.preventDefault();
        onInsertBlockAfter?.(block.id, 'todo');
        return;
      }
      if (block.type === 'bullet') {
        e.preventDefault();
        onInsertBlockAfter?.(block.id, 'bullet');
        return;
      }
      if (block.type === 'numbered') {
        e.preventDefault();
        onInsertBlockAfter?.(block.id, 'numbered');
        return;
      }
    }

    // 2. Tab key: Indent / sub-bullet hierarchy (replaces auto table insertion!)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const newIndent = Math.max(0, (block.indent || 0) - 1);
        onUpdateBlock(block.id, { indent: newIndent });
      } else {
        const newIndent = Math.min(4, (block.indent || 0) + 1);
        onUpdateBlock(block.id, { indent: newIndent });
      }
      return;
    }

    // 3. Backspace key when empty: un-indents or cancels bullet mode back to paragraph
    if (e.key === 'Backspace' && (!block.content || block.content.trim() === '')) {
      if (block.indent && block.indent > 0) {
        e.preventDefault();
        onUpdateBlock(block.id, { indent: block.indent - 1 });
        return;
      }
      if (block.type === 'bullet' || block.type === 'numbered' || block.type === 'todo') {
        e.preventDefault();
        onUpdateBlock(block.id, { type: 'paragraph', indent: 0 });
        return;
      }
    }
  };

  const blockFontClass = block.fontFamily === 'mono'
    ? 'font-mono'
    : block.fontFamily === 'serif'
    ? 'font-serif'
    : block.fontFamily === 'display'
    ? 'font-sans tracking-tight'
    : '';

  const blockTextStyle = block.textColor ? { color: block.textColor } : undefined;

  return (
    <Reorder.Item
      value={block}
      id={block.id}
      data-block-id={block.id}
      dragListener={false}
      dragControls={dragControls}
      onContextMenu={(e) => onContextMenu?.(e, block)}
      initial={isWorkspaceEntering ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      layout={isWorkspaceEntering ? undefined : 'position'}
      exit={{
        opacity: 0,
        scale: 0.94,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        overflow: 'hidden',
        transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
      }}
      className={`group relative flex items-start gap-1.5 py-0.5 px-2 rounded-lg transition-colors ${
        darkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100/70'
      }`}
      style={{ position: 'relative' }}
      whileDrag={{
        scale: 1.015,
        zIndex: 60,
      }}
      transition={
        isWorkspaceEntering
          ? { duration: 0 }
          : { type: 'spring', damping: 36, stiffness: 320, bounce: 0 }
      }
    >
      {/* Outer Skirt Controls: Drag Handle, Delete, and Companion Controls */}
      <div className="opacity-70 md:opacity-0 md:group-hover:opacity-100 transition flex flex-col items-center gap-1 shrink-0 pt-0.5 text-slate-500 relative z-30">
        <div className="flex items-center gap-0.5 h-5">
          <button
            data-lenis-prevent
            type="button"
            onPointerDown={(e) => dragControls.start(e)}
            className="p-0.5 rounded cursor-grab active:cursor-grabbing hover:text-amber-400 hover:bg-white/5 transition touch-none select-none outline-none focus:outline-none focus:ring-0 active:outline-none"
            title="Drag up or down to reorder block"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="p-0.5 rounded hover:text-red-500 hover:bg-white/5 transition outline-none focus:outline-none"
            title="Delete Block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table Row Controls: Reorder Drag Handle + Delete Row */}
        {block.type === 'table' && (
          <div className="flex flex-col items-center gap-1 pt-1.5 mt-0.5 border-t border-slate-700/30 dark:border-white/10 w-full" title="Row Controls">
            {(block.tableRows || []).map((_, rIdx) => {
              const totalRows = (block.tableRows || []).length;
              return (
                <div
                  key={rIdx}
                  onDragOver={(e) => handleRowDragOver(e, rIdx)}
                  onDrop={(e) => handleRowDrop(e, rIdx)}
                  className={`flex items-center gap-0.5 p-0.5 rounded transition ${
                    draggedRowIdx === rIdx
                      ? 'opacity-30'
                      : dragOverRowIdx === rIdx
                      ? 'ring-1 ring-cyan-400 bg-cyan-500/10'
                      : ''
                  }`}
                >
                  {/* Drag Handle to reorder row */}
                  <div
                    draggable={true}
                    onDragStart={(e) => handleRowDragStart(e, rIdx)}
                    onDragEnd={handleRowDragEnd}
                    className="p-1 rounded text-slate-400/60 hover:text-cyan-400 cursor-grab active:cursor-grabbing select-none transition flex items-center justify-center"
                    title={`Hold left click and drag to move Row ${rIdx + 1}`}
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Delete row button (greyed out) */}
                  <button
                    type="button"
                    onClick={() => {
                      const currentRows = block.tableRows || [];
                      const newRows = currentRows.filter((_, ri) => ri !== rIdx);
                      if (newRows.length === 0) {
                        onDelete(block.id);
                      } else {
                        const oldColors = block.tableCellColors || {};
                        const newColors: Record<string, string> = {};
                        for (const [key, color] of Object.entries(oldColors)) {
                          if (key.startsWith('th-')) {
                            newColors[key] = color;
                          } else {
                            const [rStr, cStr] = key.split('-');
                            const r = parseInt(rStr, 10);
                            if (r < rIdx) {
                              newColors[key] = color;
                            } else if (r > rIdx) {
                              newColors[`${r - 1}-${cStr}`] = color;
                            }
                          }
                        }
                        onUpdateBlock(block.id, { tableRows: newRows, tableCellColors: newColors });
                      }
                    }}
                    onMouseEnter={() => setHoveredDeleteRowIdx(rIdx)}
                    onMouseLeave={() => setHoveredDeleteRowIdx(null)}
                    className={`p-1 rounded transition flex items-center justify-center outline-none focus:outline-none ${
                      hoveredDeleteRowIdx === rIdx
                        ? 'text-red-400 bg-red-500/20 shadow-xs'
                        : darkMode
                        ? 'text-slate-500/60 hover:text-red-400 hover:bg-white/5'
                        : 'text-slate-400/60 hover:text-red-500 hover:bg-black/5'
                    }`}
                    title={`Delete Row ${rIdx + 1}${ totalRows <= 1 ? ' (Deletes table)' : '' }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Parallel Block Selector (beneath delete icon in vertical format, book icon only) */}
        {block.type === 'image' && (
          <div ref={parallelMenuRef} className="relative mt-0.5">
            <button
              type="button"
              onClick={() => setIsParallelMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded-md transition flex items-center justify-center border ${
                isParallel
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-sm'
                  : darkMode
                  ? 'border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 hover:bg-white/5'
                  : 'border-slate-200 text-slate-600 hover:text-cyan-700 hover:border-cyan-400 hover:bg-black/5'
              }`}
              title="Configure parallel companion block"
            >
              <Book className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </button>

            {/* Popover Dropdown expanding to the right side of the screen */}
            {isParallelMenuOpen && (
              <div
                className={`absolute left-full top-0 ml-2 w-64 rounded-xl p-1.5 border shadow-2xl z-50 backdrop-blur-2xl ${
                  darkMode
                    ? 'bg-slate-900/95 border-white/15 text-slate-200 shadow-black/80'
                    : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/30'
                }`}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-white/5 mb-1 flex items-center justify-between">
                  <span>Pair With Companion Item</span>
                  <span className="text-cyan-400 text-[9px]">Parallel</span>
                </div>

                <div className="space-y-0.5 max-h-60 overflow-y-auto no-scrollbar">
                  {PARALLEL_OPTIONS.map((opt) => {
                    const isSelected = isParallel && (block.sideBlockType || 'code') === opt.type;
                    const Icon = opt.Icon;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleSelectParallelOption(opt.type)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                            : darkMode
                            ? 'hover:bg-white/5 text-slate-300'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${opt.colorClass}`} />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>

                {/* Parallel Quick Actions (Swap & Turn Off) */}
                {isParallel && (
                  <div className="mt-1 pt-1 border-t border-white/10 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleSwapSides();
                        setIsParallelMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] transition text-left ${
                        darkMode ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ArrowLeftRight
                          className={`w-3 h-3 text-cyan-400 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isSwapping ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                        <span>Swap Side ({block.sideMode === 'left' ? 'Image Left' : 'Image Right'})</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBlock(block.id, { sideMode: 'none', width: 100 });
                        setIsParallelMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 transition text-left"
                    >
                      <span>✕ Standalone (Remove Parallel)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Type Renders */}
      <div className="flex-1 min-w-0">
        {/* 1. IMAGE TILE (WITH VERTICAL RESIZING & PARALLEL COMPANION LAYOUT) */}
        {block.type === 'image' && (
          <div ref={containerRef} className="w-full">
            {block.sideMode && block.sideMode !== 'none' ? (
              /* Parallel Side-by-Side: Image Tile + Companion Block */
              <motion.div
                layout={isResizing ? false : 'position'}
                transition={
                  isResizing
                    ? { duration: 0 }
                    : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
                }
                className={`flex flex-col lg:flex-row gap-3 items-stretch w-full max-w-full overflow-hidden ${
                  block.sideMode === 'right' ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Resizable Image Tile Column */}
                <motion.div
                  layout={isResizing ? false : 'position'}
                  transition={
                    isResizing
                      ? { duration: 0 }
                      : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
                  }
                  className={`relative flex flex-col shrink-0 min-w-0 max-w-full rounded-2xl ${
                    isSwapping
                      ? darkMode
                        ? 'z-10 shadow-xl shadow-black/50 border border-slate-700/80'
                        : 'z-10 shadow-lg shadow-slate-300/70 border border-slate-300'
                      : ''
                  }`}
                  style={{
                    width: `calc(${effectiveWidth}% - 6px)`,
                    maxWidth: '100%',
                    transition: isSwapping ? 'box-shadow 0.35s ease, border-color 0.35s ease' : undefined,
                    willChange: isResizing || isSwapping ? 'width, transform' : undefined,
                  }}
                >
                  {renderImageTileCard()}
                </motion.div>

                {/* Vertical Divider / Split Resizer Handle */}
                <motion.div
                  layout={isResizing ? false : 'position'}
                  transition={
                    isResizing
                      ? { duration: 0 }
                      : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
                  }
                  onMouseDown={handleResizeMouseDown}
                  className="hidden lg:flex w-3 cursor-col-resize items-center justify-center -mx-1 group z-10 select-none shrink-0"
                  title="Drag horizontally to resize image and companion block split"
                >
                  <div
                    className={`h-16 rounded-full transition-all shadow-sm ${
                      isResizing
                        ? 'w-1.5 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
                        : isSwapping
                        ? darkMode
                          ? 'w-1 bg-slate-500'
                          : 'w-1 bg-slate-400'
                        : 'w-1 group-hover:w-1.5 bg-slate-400/30 dark:bg-slate-600/40 group-hover:bg-cyan-400'
                    }`}
                  />
                </motion.div>

                {/* Parallel Companion Column */}
                <motion.div
                  layout={isResizing ? false : 'position'}
                  transition={
                    isResizing
                      ? { duration: 0 }
                      : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
                  }
                  className={`flex-1 min-w-0 max-w-full rounded-2xl ${
                    isSwapping
                      ? darkMode
                        ? 'z-10 shadow-xl shadow-black/50 border border-slate-700/80'
                        : 'z-10 shadow-lg shadow-slate-300/70 border border-slate-300'
                      : ''
                  }`}
                  style={{
                    transition: isSwapping ? 'box-shadow 0.35s ease, border-color 0.35s ease' : undefined,
                    willChange: isResizing || isSwapping ? 'height, transform' : undefined,
                  }}
                >
                  {renderParallelCompanionCard()}
                </motion.div>
              </motion.div>
            ) : (
              /* Standalone Resizable Image Tile */
              <div
                className={`relative group/tile ${isResizing ? '' : 'transition-all duration-150'}`}
                style={{
                  width: `${effectiveWidth}%`,
                  minWidth: '340px',
                  maxWidth: '100%',
                  transition: isResizing ? 'none' : undefined,
                  willChange: isResizing ? 'width' : undefined,
                }}
              >
                {renderImageTileCard()}

                {/* Right edge drag-resizer handle when width < 100% or on hover */}
                <div
                  onMouseDown={handleResizeMouseDown}
                  className={`absolute top-1/2 -translate-y-1/2 -right-3 w-5 h-16 cursor-col-resize flex items-center justify-center z-20 select-none ${
                    isResizing ? '' : 'transition-opacity'
                  } ${
                    isResizing || effectiveWidth < 100
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/tile:opacity-80'
                  }`}
                  title="Drag horizontally to resize tile width"
                >
                  <div
                    className={`rounded-full shadow-md flex items-center justify-center transition-all ${
                      isResizing
                        ? 'w-2 h-12 bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.7)]'
                        : 'w-1.5 h-10 bg-cyan-400/60 hover:bg-cyan-400'
                    }`}
                  >
                    <MoveHorizontal className="w-2.5 h-2.5 text-black stroke-[3]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {block.type === 'h1' && (
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdateContent(block.id, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading 1..."
            style={blockTextStyle}
            className={`w-full text-xl sm:text-2xl font-bold bg-transparent focus:outline-none border-b border-transparent focus:border-amber-500 placeholder:opacity-40 ${blockFontClass} ${
              darkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
        )}

        {block.type === 'h2' && (
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdateContent(block.id, e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sub-heading 2..."
            style={blockTextStyle}
            className={`w-full text-lg sm:text-xl font-semibold bg-transparent focus:outline-none border-b border-transparent focus:border-amber-500 placeholder:opacity-40 ${blockFontClass} ${
              darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
        )}

        {block.type === 'paragraph' && (
          <div className="relative group/para w-full" style={{ paddingLeft: `${(block.indent || 0) * 20}px` }}>
            {mathInfo.hasMath && !isEditingParagraphMath ? (
              <div
                className={`cursor-text text-sm leading-relaxed select-text py-0.5 ${blockFontClass} ${
                  darkMode ? 'text-slate-300' : 'text-slate-800'
                }`}
                style={blockTextStyle}
                onClick={() => setIsEditingParagraphMath(true)}
                dangerouslySetInnerHTML={{ __html: mathInfo.html }}
                title="Click to edit formula or text"
              />
            ) : (
              <AutoExpandingTextarea
                value={block.content}
                autoFocus={isEditingParagraphMath}
                onFocus={() => setIsEditingParagraphMath(true)}
                onBlur={() => setIsEditingParagraphMath(false)}
                onChange={(val) => {
                  if (val === '- ' || val === '* ') {
                    onUpdateBlock(block.id, { type: 'bullet', content: '' });
                    return;
                  }
                  if (val === '[] ' || val === '[ ] ') {
                    onUpdateBlock(block.id, { type: 'todo', content: '' });
                    return;
                  }
                  onUpdateContent(block.id, val);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type notes, formulas, or '- ' for bullet list..."
                style={blockTextStyle}
                className={`text-sm leading-relaxed placeholder:opacity-40 ${blockFontClass} ${
                  darkMode ? 'text-slate-300 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
                }`}
              />
            )}
            {mathInfo.hasMath && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingParagraphMath(!isEditingParagraphMath);
                }}
                className={`absolute right-0 top-0 opacity-0 group-hover/para:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 border transition select-none ${
                  isEditingParagraphMath
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                    : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                }`}
                title={isEditingParagraphMath ? 'Render formatted math' : 'Edit raw text / LaTeX'}
              >
                <Sigma className="w-3 h-3 text-violet-400" />
                <span>{isEditingParagraphMath ? 'Render' : 'Edit'}</span>
              </button>
            )}
          </div>
        )}

        {block.type === 'bullet' && (() => {
          const items = (block.bulletItems && block.bulletItems.length > 0)
            ? block.bulletItems
            : [{ id: 'b-0', text: block.content || '', indent: block.indent || 0 }];

          const updateItems = (newItems: Array<{ id: string; text: string; indent: number }>, focusId?: string) => {
            onUpdateBlock(block.id, {
              bulletItems: newItems,
              content: newItems.map((it) => it.text).join('\n'),
              indent: newItems[0]?.indent || 0,
            });
            if (focusId) {
              setTimeout(() => {
                const el = document.getElementById(`bullet-input-${block.id}-${focusId}`);
                if (el) el.focus();
              }, 10);
            }
          };

          return (
            <div className="w-full space-y-1">
              {items.map((item, idx) => {
                const indentLevel = Math.min(3, Math.max(0, item.indent || 0));
                // Hierarchical bullets: indent 0 = •, indent 1 = ◦, indent 2+ = ▪
                const bulletGlyph = indentLevel === 0 ? '•' : indentLevel === 1 ? '◦' : '▪';

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 w-full transition-all"
                    style={{ paddingLeft: `${indentLevel * 22}px` }}
                  >
                    <span
                      className="font-bold select-none shrink-0 text-amber-400 font-mono transition-transform mt-0.5"
                      style={{
                        fontSize: indentLevel === 0 ? '14px' : indentLevel === 1 ? '12px' : '10px',
                        width: '14px',
                        textAlign: 'center',
                      }}
                    >
                      {bulletGlyph}
                    </span>
                    <AutoExpandingTextarea
                      id={`bullet-input-${block.id}-${item.id}`}
                      value={item.text}
                      onChange={(val) => {
                        const next = [...items];
                        next[idx] = { ...item, text: val };
                        updateItems(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const next = [...items];
                          if (e.shiftKey) {
                            next[idx] = { ...item, indent: Math.max(0, indentLevel - 1) };
                          } else {
                            next[idx] = { ...item, indent: Math.min(3, indentLevel + 1) };
                          }
                          updateItems(next);
                          return;
                        }

                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (item.text.trim() === '') {
                            // Enter on empty bullet item
                            if (indentLevel > 0) {
                              const next = [...items];
                              next[idx] = { ...item, indent: indentLevel - 1 };
                              updateItems(next);
                            } else {
                              if (items.length > 1) {
                                const next = items.filter((_, i) => i !== idx);
                                updateItems(next, items[Math.max(0, idx - 1)]?.id);
                                onInsertBlockAfter?.(block.id, 'paragraph');
                              } else {
                                onUpdateBlock(block.id, { type: 'paragraph', content: '', indent: 0, bulletItems: undefined });
                              }
                            }
                            return;
                          }

                          // Insert new bullet item right after with identical indent
                          const newId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                          const next = [...items];
                          next.splice(idx + 1, 0, { id: newId, text: '', indent: indentLevel });
                          updateItems(next, newId);
                          return;
                        }

                        if (e.key === 'Backspace' && item.text === '') {
                          e.preventDefault();
                          if (indentLevel > 0) {
                            const next = [...items];
                            next[idx] = { ...item, indent: indentLevel - 1 };
                            updateItems(next);
                          } else if (items.length > 1) {
                            const next = items.filter((_, i) => i !== idx);
                            updateItems(next, items[Math.max(0, idx - 1)]?.id);
                          } else {
                            onUpdateBlock(block.id, { type: 'paragraph', content: '', indent: 0, bulletItems: undefined });
                          }
                        }
                      }}
                      placeholder="List item..."
                      className={`flex-1 text-sm leading-relaxed ${
                        darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

        {block.type === 'numbered' && (() => {
          const rawItems: Array<{ id: string; text: string; indent?: number }> = (block.numberedItems && block.numberedItems.length > 0)
            ? block.numberedItems
            : block.content.includes('\n')
            ? block.content.split('\n').map((line, i) => ({
                id: `num-init-${i}-${block.id}`,
                text: line.replace(/^\s*\d+[\.\)]\s*/, ''),
                indent: block.indent || 0,
              }))
            : [{ id: `num-0-${block.id}`, text: block.content.replace(/^\s*\d+[\.\)]\s*/, ''), indent: block.indent || 0 }];
          const items: Array<{ id: string; text: string; indent?: number }> = rawItems.length > 0 ? rawItems : [{ id: `num-0-${block.id}`, text: '', indent: block.indent || 0 }];

          const updateNumberedItems = (next: typeof items, focusId?: string) => {
            onUpdateBlock(block.id, {
              numberedItems: next,
              content: next.map((it, idx) => `${idx + 1}. ${it.text}`).join('\n'),
            });
            if (focusId) {
              setTimeout(() => {
                const el = document.getElementById(`numbered-input-${block.id}-${focusId}`);
                if (el) el.focus();
              }, 10);
            }
          };

          return (
            <div className="w-full space-y-1">
              {items.map((item, idx) => {
                const indentLevel = item.indent ?? (block.indent || 0);
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 w-full"
                    style={{ paddingLeft: `${indentLevel * 20}px` }}
                  >
                    <span
                      className={`text-xs font-mono font-bold mt-0.5 shrink-0 ${blockFontClass}`}
                      style={blockTextStyle || { color: effectiveThemeColor }}
                    >
                      {idx + 1}.
                    </span>
                    <AutoExpandingTextarea
                      id={`numbered-input-${block.id}-${item.id}`}
                      value={item.text}
                      onChange={(val) => {
                        const next = [...items];
                        next[idx] = { ...item, text: val };
                        updateNumberedItems(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const next = [...items];
                          if (e.shiftKey) {
                            next[idx] = { ...item, indent: Math.max(0, indentLevel - 1) };
                          } else {
                            next[idx] = { ...item, indent: Math.min(3, indentLevel + 1) };
                          }
                          updateNumberedItems(next);
                          return;
                        }

                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (item.text.trim() === '') {
                            // Empty line on Enter: outdent or convert back to paragraph
                            if (indentLevel > 0) {
                              const next = [...items];
                              next[idx] = { ...item, indent: indentLevel - 1 };
                              updateNumberedItems(next);
                            } else {
                              if (items.length > 1) {
                                const next = items.filter((_, i) => i !== idx);
                                updateNumberedItems(next, items[Math.max(0, idx - 1)]?.id);
                                onInsertBlockAfter?.(block.id, 'paragraph');
                              } else {
                                onUpdateBlock(block.id, { type: 'paragraph', content: '', indent: 0, numberedItems: undefined });
                              }
                            }
                            return;
                          }

                          // Auto-progress to next numbered item (2., 3., 4., etc.)
                          const newId = `num-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                          const next = [...items];
                          next.splice(idx + 1, 0, { id: newId, text: '', indent: indentLevel });
                          updateNumberedItems(next, newId);
                          return;
                        }

                        if (e.key === 'Backspace' && item.text === '') {
                          e.preventDefault();
                          if (indentLevel > 0) {
                            const next = [...items];
                            next[idx] = { ...item, indent: indentLevel - 1 };
                            updateNumberedItems(next);
                          } else if (items.length > 1) {
                            const next = items.filter((_, i) => i !== idx);
                            updateNumberedItems(next, items[Math.max(0, idx - 1)]?.id);
                          } else {
                            onUpdateBlock(block.id, { type: 'paragraph', content: '', indent: 0, numberedItems: undefined });
                          }
                        }
                      }}
                      placeholder="Numbered item..."
                      style={blockTextStyle}
                      className={`flex-1 text-sm leading-relaxed ${blockFontClass} ${
                        darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

        {block.type === 'todo' && (() => {
          const items = (block.todoItems && block.todoItems.length > 0)
            ? block.todoItems
            : [{ id: 't-0', text: block.content || '', checked: Boolean(block.checked) }];

          const updateItems = (newItems: Array<{ id: string; text: string; checked: boolean }>, focusId?: string) => {
            onUpdateBlock(block.id, {
              todoItems: newItems,
              content: newItems.map((it) => `${it.checked ? '[x] ' : '[ ] '}${it.text}`).join('\n'),
              checked: newItems.every((it) => it.checked),
            });
            if (focusId) {
              setTimeout(() => {
                const el = document.getElementById(`todo-input-${block.id}-${focusId}`);
                if (el) el.focus();
              }, 10);
            }
          };

          return (
            <div className="w-full space-y-1">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...items];
                      next[idx] = { ...item, checked: !item.checked };
                      updateItems(next);
                    }}
                    className="text-amber-500 shrink-0 mt-0.5 hover:opacity-80 transition cursor-pointer"
                  >
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 fill-amber-500/20 text-amber-500" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 hover:text-amber-400" />
                    )}
                  </button>
                  <AutoExpandingTextarea
                    id={`todo-input-${block.id}-${item.id}`}
                    value={item.text}
                    onChange={(val) => {
                      const next = [...items];
                      next[idx] = { ...item, text: val };
                      updateItems(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const newId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                        const next = [...items];
                        next.splice(idx + 1, 0, { id: newId, text: '', checked: false });
                        updateItems(next, newId);
                        return;
                      }

                      if (e.key === 'Backspace' && item.text === '') {
                        e.preventDefault();
                        if (items.length > 1) {
                          const next = items.filter((_, i) => i !== idx);
                          updateItems(next, items[Math.max(0, idx - 1)]?.id);
                        } else {
                          onUpdateBlock(block.id, { type: 'paragraph', content: '', todoItems: undefined, checked: false });
                        }
                      }
                    }}
                    placeholder="Action item..."
                    className={`flex-1 text-sm leading-relaxed ${
                      item.checked
                        ? darkMode
                          ? 'line-through text-slate-500'
                          : 'line-through text-slate-400'
                        : darkMode
                        ? 'text-slate-200 placeholder:text-slate-500'
                        : 'text-slate-900 font-medium placeholder:text-slate-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          );
        })()}

        {block.type === 'code' && (
          <CodeEditor
            value={block.content || ''}
            onChange={(val) => onUpdateContent(block.id, val)}
            language={block.language || 'python'}
            onLanguageChange={(lang) => onUpdateBlock(block.id, { language: lang })}
            darkMode={darkMode}
            themeColor={effectiveThemeColor}
          />
        )}

        {block.type === 'callout' && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 relative group/callout transition-all ${
              darkMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {mathInfo.hasMath && !isEditingCalloutMath ? (
                <div
                  className="cursor-text text-xs sm:text-sm font-medium leading-relaxed select-text"
                  onClick={() => setIsEditingCalloutMath(true)}
                  dangerouslySetInnerHTML={{ __html: mathInfo.html }}
                  title="Click to edit formula or text"
                />
              ) : (
                <AutoExpandingTextarea
                  value={block.content}
                  autoFocus={isEditingCalloutMath}
                  onFocus={() => setIsEditingCalloutMath(true)}
                  onBlur={() => setIsEditingCalloutMath(false)}
                  onChange={(val) => onUpdateContent(block.id, val)}
                  onKeyDown={handleKeyDown}
                  placeholder="Highlighted principle, mathematical formula, or conceptual note..."
                  className={`text-xs sm:text-sm font-medium leading-relaxed placeholder:opacity-40 ${
                    darkMode ? 'text-amber-200 placeholder:text-amber-200/40' : 'text-amber-950 placeholder:text-amber-950/40'
                  }`}
                />
              )}
            </div>
            {mathInfo.hasMath && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingCalloutMath(!isEditingCalloutMath);
                }}
                className={`opacity-0 group-hover/callout:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 border transition shrink-0 select-none ${
                  isEditingCalloutMath
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                }`}
                title={isEditingCalloutMath ? 'Render formatted math' : 'Edit raw text / LaTeX'}
              >
                <Sigma className="w-3 h-3 text-amber-400" />
                <span>{isEditingCalloutMath ? 'Render' : 'Edit'}</span>
              </button>
            )}
          </div>
        )}

        {block.type === 'quote' && (
          <div
            className={`pl-4 border-l-2 border-amber-500 italic relative group/quote ${
              darkMode ? 'text-slate-300' : 'text-slate-800'
            }`}
          >
            {mathInfo.hasMath && !isEditingQuoteMath ? (
              <div
                className="cursor-text text-xs sm:text-sm leading-relaxed select-text py-0.5"
                onClick={() => setIsEditingQuoteMath(true)}
                dangerouslySetInnerHTML={{ __html: mathInfo.html }}
                title="Click to edit formula or text"
              />
            ) : (
              <AutoExpandingTextarea
                value={block.content}
                autoFocus={isEditingQuoteMath}
                onFocus={() => setIsEditingQuoteMath(true)}
                onBlur={() => setIsEditingQuoteMath(false)}
                onChange={(val) => onUpdateContent(block.id, val)}
                onKeyDown={handleKeyDown}
                placeholder="Write quote or insight..."
                className={`text-xs sm:text-sm leading-relaxed placeholder:opacity-40 ${
                  darkMode ? 'text-slate-300 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
                }`}
              />
            )}
            {mathInfo.hasMath && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingQuoteMath(!isEditingQuoteMath);
                }}
                className={`absolute right-0 top-0 opacity-0 group-hover/quote:opacity-100 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 border transition select-none ${
                  isEditingQuoteMath
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                }`}
                title={isEditingQuoteMath ? 'Render formatted math' : 'Edit raw text / LaTeX'}
              >
                <Sigma className="w-3 h-3 text-amber-400" />
                <span>{isEditingQuoteMath ? 'Render' : 'Edit'}</span>
              </button>
            )}
          </div>
        )}

        {/* 9. MATHEMATICAL FORMULATION / FORMULA BLOCK */}
        {block.type === 'math' && (
          <div
            className={`rounded-xl border shadow-sm transition-all overflow-hidden ${
              darkMode
                ? 'bg-[#181b26] border-violet-500/30 shadow-black/40'
                : 'bg-white border-violet-200 shadow-violet-100/50'
            }`}
          >
            {/* Math Header Bar */}
            <div
              className={`px-3 py-2 border-b flex items-center justify-between text-xs select-none ${
                darkMode ? 'bg-[#141722] border-violet-500/20 text-slate-300' : 'bg-violet-50/70 border-violet-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-violet-500/15 text-violet-400">
                  <Sigma className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Mathematical Formulation'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Mathematical Formulation"
                  className="font-semibold text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-violet-400 rounded px-1 -ml-1 text-violet-400"
                />
              </div>

              <div className="flex items-center gap-1.5 relative">
                {/* Math Presets Button & Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMathPresetsOpen(!isMathPresetsOpen)}
                    className={`px-2 py-1 rounded text-[11px] font-sans flex items-center gap-1 transition border ${
                      darkMode
                        ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs'
                    }`}
                    title="Insert common formula preset"
                  >
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    <span>Presets</span>
                  </button>

                  {isMathPresetsOpen && (
                    <div
                      className={`absolute right-0 top-full mt-1 w-64 rounded-xl border p-1.5 shadow-2xl z-50 text-xs ${
                        darkMode ? 'bg-slate-900 border-slate-700 text-slate-200 shadow-black/90' : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
                      }`}
                    >
                      <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider opacity-60 font-semibold border-b border-inherit mb-1">
                        Formula Presets
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {MATH_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              onUpdateContent(block.id, preset.latex);
                              onUpdateBlock(block.id, { sideBlockName: preset.name });
                              setIsMathPresetsOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg transition flex flex-col ${
                              darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <span className="font-semibold text-violet-400 text-xs">{preset.name}</span>
                            <span className="text-[10px] opacity-60 truncate">{preset.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Copy LaTeX Button */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(block.content || '');
                    setIsCopiedMath(true);
                    setTimeout(() => setIsCopiedMath(false), 1500);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-sans flex items-center gap-1 transition border ${
                    darkMode
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs'
                  }`}
                  title="Copy LaTeX formula code"
                >
                  {isCopiedMath ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedMath ? 'Copied' : 'LaTeX'}</span>
                </button>
              </div>
            </div>

            {/* Rendered Math Formula Display */}
            <div className={`p-4 sm:p-6 flex items-center justify-center overflow-x-auto min-h-[90px] select-text ${
              darkMode ? 'bg-slate-950/40 text-slate-100' : 'bg-slate-50/50 text-slate-900'
            }`}>
              <div
                className="text-base sm:text-lg"
                dangerouslySetInnerHTML={{
                  __html: renderKatex(
                    normalizeMathExpression(
                      block.content || '\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V'
                    ),
                    true
                  ),
                }}
              />
            </div>

            {/* LaTeX / Formula Input Editor */}
            <div className={`p-2.5 border-t text-xs flex items-center gap-2 ${
              darkMode ? 'bg-[#151824] border-slate-800' : 'bg-slate-100/70 border-slate-200'
            }`}>
              <span className="font-mono text-[10px] opacity-50 uppercase tracking-wider shrink-0 select-none">
                LaTeX:
              </span>
              <input
                type="text"
                value={block.content}
                onChange={(e) => onUpdateContent(block.id, e.target.value)}
                placeholder="Enter LaTeX formula or math expression (e.g. \text{Attention}(Q, K, V) = ...)"
                className={`flex-1 bg-transparent font-mono text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 rounded px-1.5 py-0.5 ${
                  darkMode ? 'text-violet-300 placeholder:text-slate-600' : 'text-violet-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>
        )}

        {/* 8. INTERACTIVE TABLE BLOCK (Native OneNote UI, Solid Notebook Grid, No Liquid Glass) */}
        {block.type === 'table' && (
          <div
            data-table-block="true"
            className={`onenote-table-block rounded-xl border overflow-hidden shadow-sm no-lift no-tilt transition ${
              darkMode
                ? 'bg-[#1a1e2d] border-slate-700/80 text-slate-200 shadow-black/40'
                : 'bg-white border-slate-300 text-slate-800 shadow-slate-200/50'
            }`}
          >
            {/* Table Header & Controls Bar */}
            <div
              className={`px-3 py-2 border-b flex items-center justify-between text-xs font-mono select-none ${
                darkMode ? 'bg-[#151824] border-slate-700/80 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TableIcon className="w-3.5 h-3.5 shrink-0" style={{ color: effectiveThemeColor }} />
                <input
                  type="text"
                  value={block.sideBlockName ?? 'Interactive Table'}
                  onChange={(e) => onUpdateBlock(block.id, { sideBlockName: e.target.value })}
                  placeholder="Interactive Table"
                  title="Click to edit table name"
                  className="font-semibold uppercase tracking-wider text-[11px] bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-400 rounded px-1 -ml-1 transition hover:opacity-90 max-w-[180px] sm:max-w-none"
                  style={{ color: effectiveThemeColor }}
                />
                <span className="text-[10px] opacity-60 shrink-0 font-sans">
                  ({(block.tableRows || []).length} rows × {(block.tableHeaders || []).length} cols)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const headers = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
                    const rows = (block.tableRows || [['', '', '']]).map((r) => [...r, '']);
                    headers.push(`Column ${headers.length + 1}`);
                    onUpdateBlock(block.id, { tableHeaders: headers, tableRows: rows });
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-sans flex items-center gap-1 transition border ${
                    darkMode
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs'
                  }`}
                  title="Add new column to table"
                >
                  <Plus className="w-3 h-3" style={{ color: effectiveThemeColor }} />
                  <span>Column</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const headers = block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'];
                    const rows = [...(block.tableRows || [['', '', '']])];
                    rows.push(new Array(headers.length).fill(''));
                    onUpdateBlock(block.id, { tableHeaders: headers, tableRows: rows });
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-sans flex items-center gap-1 transition border ${
                    darkMode
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs'
                  }`}
                  title="Add new row to table"
                >
                  <Plus className="w-3 h-3" style={{ color: effectiveThemeColor }} />
                  <span>Row</span>
                </button>
              </div>
            </div>

            {/* Responsive Table Grid */}
            <div className="overflow-x-auto no-scrollbar py-1">
              <table
                ref={tableElementRef}
                className="w-full border-separate border-spacing-0 text-left text-xs sm:text-sm"
                onContextMenu={(e) => {
                  const cell = (e.target as HTMLElement | null)?.closest('th, td');
                  if (!cell) {
                    openTableContextMenu(e, 'th-0', 0, true);
                  }
                }}
              >
                <thead>
                  <tr className={darkMode ? 'bg-slate-900/80' : 'bg-slate-100/90'}>
                    {(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3']).map((header, colIdx) => {
                      const customStyle = getCustomCellStyle(`th-${colIdx}`, true);

                      const handleRightClick = (e: React.MouseEvent) => {
                        openTableContextMenu(e, `th-${colIdx}`, colIdx, true);
                      };

                      return (
                        <th
                          key={colIdx}
                          onDragOver={(e) => handleColDragOver(e, colIdx)}
                          onDrop={(e) => handleColDrop(e, colIdx)}
                          onContextMenu={handleRightClick}
                          style={customStyle}
                          title="Right-click for options (colors, add/delete rows & cols) | Hold left click on handle to drag column"
                          className={`group/th p-2 sm:p-2.5 font-semibold font-mono text-[11px] uppercase tracking-wider relative border-b border-r last:border-r-0 border-inherit transition-all ${
                            draggedColIdx === colIdx
                              ? 'opacity-30'
                              : dragOverColIdx === colIdx
                              ? darkMode
                                ? 'ring-2 ring-cyan-400 bg-cyan-500/10'
                                : 'ring-2 ring-cyan-500 bg-cyan-50'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            {/* Column Drag Handle: hold with left click and drag to reorder column */}
                            <div
                              draggable={true}
                              onDragStart={(e) => handleColDragStart(e, colIdx)}
                              onDragEnd={handleColDragEnd}
                              className="cursor-grab active:cursor-grabbing p-0.5 rounded text-slate-400 hover:text-cyan-400 opacity-60 hover:opacity-100 transition shrink-0 select-none"
                              title={`Hold left click and drag to move Column ${colIdx + 1}`}
                            >
                              <GripVertical className="w-3 h-3" />
                            </div>

                            <input
                              type="text"
                              value={header}
                              onContextMenu={handleRightClick}
                              onChange={(e) => {
                                const newHeaders = [...(block.tableHeaders || ['Column 1', 'Column 2', 'Column 3'])];
                                newHeaders[colIdx] = e.target.value;
                                onUpdateBlock(block.id, { tableHeaders: newHeaders });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab') {
                                  e.preventDefault();
                                  const headersCount = block.tableHeaders?.length || 3;
                                  const target = e.shiftKey
                                    ? (colIdx > 0
                                        ? document.getElementById(`tbl-${block.id}-th-${colIdx - 1}`)
                                        : null)
                                    : (colIdx < headersCount - 1
                                        ? document.getElementById(`tbl-${block.id}-th-${colIdx + 1}`)
                                        : document.getElementById(`tbl-${block.id}-cell-0-0`));
                                  target?.focus();
                                }
                              }}
                              id={`tbl-${block.id}-th-${colIdx}`}
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-400 rounded px-1 py-0.5 font-bold"
                              style={{ color: customStyle?.color || effectiveThemeColor }}
                              placeholder={`Column ${colIdx + 1}`}
                            />
                            {(block.tableHeaders || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const headers = (block.tableHeaders || []).filter((_, i) => i !== colIdx);
                                  const rows = (block.tableRows || []).map((row) => row.filter((_, i) => i !== colIdx));
                                  onUpdateBlock(block.id, { tableHeaders: headers, tableRows: rows });
                                }}
                                className="opacity-0 group-hover/th:opacity-100 transition p-0.5 rounded hover:text-red-400 text-slate-400 shrink-0"
                                title="Delete column"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(block.tableRows || [['', '', '']]).map((row, rowIdx) => {
                    const totalCols = (block.tableHeaders || ['Column 1', 'Column 2', 'Column 3']).length;
                    const totalRows = (block.tableRows || [['', '', '']]).length;

                    return (
                      <tr
                        key={rowIdx}
                        onDragOver={(e) => handleRowDragOver(e, rowIdx)}
                        onDrop={(e) => handleRowDrop(e, rowIdx)}
                        className={`group/tr transition-colors ${
                          draggedRowIdx === rowIdx
                            ? 'opacity-30'
                            : dragOverRowIdx === rowIdx
                            ? darkMode
                              ? 'ring-2 ring-cyan-400 bg-cyan-500/10'
                              : 'ring-2 ring-cyan-500 bg-cyan-50'
                            : hoveredDeleteRowIdx === rowIdx
                            ? darkMode
                              ? 'bg-red-500/15'
                              : 'bg-red-50'
                            : darkMode
                            ? 'hover:bg-slate-800/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {row.map((cellValue, colIdx) => {
                          const isLastCell = rowIdx === totalRows - 1 && colIdx === totalCols - 1;
                          const customCellStyle = getCustomCellStyle(`${rowIdx}-${colIdx}`, false);

                          const handleRightClick = (e: React.MouseEvent) => {
                            openTableContextMenu(e, `${rowIdx}-${colIdx}`, colIdx, false, rowIdx);
                          };

                          return (
                            <td
                              key={colIdx}
                              onContextMenu={handleRightClick}
                              onDragOver={(e) => handleColDragOver(e, colIdx)}
                              onDrop={(e) => handleColDrop(e, colIdx)}
                              style={customCellStyle}
                              title="Right-click for options (colors, add/delete rows & cols)"
                              className={`p-1 sm:p-1.5 border-r last:border-r-0 ${
                                rowIdx < totalRows - 1 ? 'border-b' : ''
                              } border-inherit transition-colors ${
                                draggedColIdx === colIdx
                                  ? 'opacity-30'
                                  : dragOverColIdx === colIdx
                                  ? darkMode
                                    ? 'bg-cyan-500/10'
                                    : 'bg-cyan-50'
                                  : ''
                              }`}
                            >
                              <input
                                type="text"
                                id={`tbl-${block.id}-cell-${rowIdx}-${colIdx}`}
                                value={cellValue}
                                onContextMenu={handleRightClick}
                                onChange={(e) => {
                                  const rows = (block.tableRows || []).map((r, ri) =>
                                    ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? e.target.value : c)) : [...r]
                                  );
                                  onUpdateBlock(block.id, { tableRows: rows });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                                    e.preventDefault();
                                    if (e.shiftKey) {
                                      // Shift+Tab: move backward
                                      if (colIdx > 0) {
                                        document.getElementById(`tbl-${block.id}-cell-${rowIdx}-${colIdx - 1}`)?.focus();
                                      } else if (rowIdx > 0) {
                                        document.getElementById(`tbl-${block.id}-cell-${rowIdx - 1}-${totalCols - 1}`)?.focus();
                                      } else {
                                        document.getElementById(`tbl-${block.id}-th-${totalCols - 1}`)?.focus();
                                      }
                                    } else {
                                      // Tab: move forward
                                      if (colIdx < totalCols - 1) {
                                        document.getElementById(`tbl-${block.id}-cell-${rowIdx}-${colIdx + 1}`)?.focus();
                                      } else if (rowIdx < totalRows - 1) {
                                        document.getElementById(`tbl-${block.id}-cell-${rowIdx + 1}-0`)?.focus();
                                      } else if (isLastCell) {
                                        // At very last cell: automatically add a new row!
                                        const newRows = [...(block.tableRows || [])];
                                        newRows.push(new Array(totalCols).fill(''));
                                        onUpdateBlock(block.id, { tableRows: newRows });
                                        setTimeout(() => {
                                          document.getElementById(`tbl-${block.id}-cell-${rowIdx + 1}-0`)?.focus();
                                        }, 50);
                                      }
                                    }
                                  } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (rowIdx < totalRows - 1) {
                                      document.getElementById(`tbl-${block.id}-cell-${rowIdx + 1}-${colIdx}`)?.focus();
                                    } else {
                                      // Add new row below and focus the cell below in the same column
                                      const newRows = [...(block.tableRows || [])];
                                      newRows.push(new Array(totalCols).fill(''));
                                      onUpdateBlock(block.id, { tableRows: newRows });
                                      setTimeout(() => {
                                        document.getElementById(`tbl-${block.id}-cell-${rowIdx + 1}-${colIdx}`)?.focus();
                                      }, 50);
                                    }
                                  }
                                }}
                                placeholder="Empty cell..."
                                className={`w-full bg-transparent px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded text-xs sm:text-sm placeholder:opacity-30 ${
                                  darkMode ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'
                                }`}
                                style={{ color: customCellStyle?.color }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Cell Color & Table Operations Context Menu (rendered via Portal for unclipped viewport positioning) */}
            {cellContextMenu && typeof document !== 'undefined' && createPortal(
              <div
                className={`table-cell-context-menu fixed z-[999999] rounded-xl p-1.5 shadow-2xl border flex flex-col gap-1 min-w-[210px] select-none text-xs ${
                  darkMode
                    ? 'bg-[#181b26]/95 backdrop-blur-md border-slate-700/90 text-slate-200 shadow-black/90'
                    : 'bg-white/95 backdrop-blur-md border-slate-300 text-slate-800 shadow-slate-400/50'
                }`}
                style={{
                  top: `${cellContextMenu.y}px`,
                  left: `${cellContextMenu.x}px`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {/* Header title */}
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider opacity-60 font-semibold border-b border-inherit flex items-center justify-between">
                  <span>
                    {cellContextMenu.isHeader
                      ? `Column ${cellContextMenu.colIdx + 1}`
                      : `Row ${(cellContextMenu.rowIdx ?? 0) + 1}, Col ${cellContextMenu.colIdx + 1}`}
                  </span>
                  <span className="text-[9px] opacity-70">Table Menu</span>
                </div>

                {/* Highlight cell color palette */}
                <div className="px-2 pt-1 text-[10px] font-semibold opacity-50 uppercase tracking-wider">Highlight Color</div>
                <div className="grid grid-cols-5 gap-1 px-1.5 py-1">
                  {TABLE_CELL_PALETTE.map((pal) => (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newColors = { ...(block.tableCellColors || {}) };
                        newColors[cellContextMenu.cellKey] = pal.id;
                        onUpdateBlock(block.id, { tableCellColors: newColors });
                        setCellContextMenu(null);
                      }}
                      className="p-1.5 rounded-lg flex items-center justify-center hover:scale-110 active:scale-95 transition hover:bg-white/10"
                      title={pal.name}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                        style={{ backgroundColor: pal.dotColor }}
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newColors = { ...(block.tableCellColors || {}) };
                      delete newColors[cellContextMenu.cellKey];
                      onUpdateBlock(block.id, { tableCellColors: newColors });
                      setCellContextMenu(null);
                    }}
                    className="p-1.5 rounded-lg flex items-center justify-center hover:scale-110 active:scale-95 transition hover:bg-white/10 text-slate-400 hover:text-red-400"
                    title="Clear highlight color"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="border-t border-inherit my-0.5" />

                {/* Row operations */}
                {cellContextMenu.rowIdx !== undefined && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleInsertRowAt(cellContextMenu.rowIdx!, true)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                        darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Insert Row Above</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertRowAt(cellContextMenu.rowIdx!, false)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                        darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Insert Row Below</span>
                    </button>
                  </>
                )}

                {/* Column operations */}
                <button
                  type="button"
                  onClick={() => handleInsertColAt(cellContextMenu.colIdx, true)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                    darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Insert Column Left</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertColAt(cellContextMenu.colIdx, false)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                    darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Insert Column Right</span>
                </button>

                <div className="border-t border-inherit my-0.5" />

                {/* Clear cell */}
                <button
                  type="button"
                  onClick={() =>
                    handleClearCellContent(
                      cellContextMenu.cellKey,
                      cellContextMenu.isHeader,
                      cellContextMenu.rowIdx,
                      cellContextMenu.colIdx
                    )
                  }
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                    darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Clear Cell Content</span>
                </button>

                {/* Delete row (if > 1 row) */}
                {cellContextMenu.rowIdx !== undefined && (block.tableRows || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRowAt(cellContextMenu.rowIdx!)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition text-red-400 hover:text-red-300 ${
                      darkMode ? 'hover:bg-red-500/15' : 'hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Delete Row {(cellContextMenu.rowIdx ?? 0) + 1}</span>
                  </button>
                )}

                {/* Delete column (if > 1 column) */}
                {(block.tableHeaders || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteColAt(cellContextMenu.colIdx)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition text-red-400 hover:text-red-300 ${
                      darkMode ? 'hover:bg-red-500/15' : 'hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Delete Column {cellContextMenu.colIdx + 1}</span>
                  </button>
                )}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </Reorder.Item>
  );
});
NoteBlockItem.displayName = 'NoteBlockItem';

interface PageBubbleItemProps {
  page: OneNotePage;
  pageNumber: number;
  isSelected: boolean;
  darkMode: boolean;
  accentColor: string;
  onSelect: (pageId: string) => void;
}

const PageBubbleItem = React.memo<PageBubbleItemProps>(({
  page,
  pageNumber,
  isSelected,
  darkMode,
  accentColor,
  onSelect,
}) => {
  return (
    <div className="relative group/bubble flex items-center justify-center shrink-0">
      <button
        type="button"
        onClick={() => onSelect(page.id)}
        className={`w-8 h-8 rounded-full border transition-all duration-200 flex items-center justify-center text-xs font-mono font-bold select-none cursor-pointer liquid-glass-tile onenote-page-tile ${
          isSelected
            ? 'scale-110 shadow-lg text-white font-extrabold'
            : darkMode
            ? 'border-white/10 bg-slate-900/60 text-slate-400 hover:text-white hover:border-amber-400/50 hover:bg-slate-800'
            : 'border-slate-300 bg-white/90 text-slate-600 hover:text-slate-900 hover:border-amber-500 shadow-sm'
        }`}
        style={
          isSelected
            ? {
                backgroundColor: `${accentColor}30`,
                borderColor: accentColor,
                color: darkMode ? '#ffffff' : accentColor,
                boxShadow: `0 0 14px ${accentColor}40`,
              }
            : undefined
        }
        aria-label={`Page ${pageNumber}: ${page.title}`}
        title={`Page ${pageNumber}: ${page.title}`}
      >
        {pageNumber}
      </button>

      {/* Hover Tooltip displaying Page Title & Index */}
      <div
        className={`absolute left-full ml-2.5 px-2.5 py-1.5 rounded-xl text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 z-50 shadow-xl border backdrop-blur-2xl ${
          darkMode
            ? 'bg-slate-900/95 border-white/15 text-slate-200 shadow-black/80'
            : 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-300/60'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="font-bold font-mono text-[11px]">#{pageNumber}</span>
          <span className="max-w-[180px] truncate font-medium">{page.title}</span>
        </div>
      </div>
    </div>
  );
});
PageBubbleItem.displayName = 'PageBubbleItem';

interface PageListItemProps {
  page: OneNotePage;
  isSelected: boolean;
  darkMode: boolean;
  accentColor: string;
  onSelect: (pageId: string) => void;
  onDelete?: (page: OneNotePage) => void;
  onRename?: (pageId: string, newTitle: string) => void;
}

const PageListItem = React.memo<PageListItemProps>(({
  page,
  isSelected,
  darkMode,
  accentColor,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(page.title);

  useEffect(() => {
    setTempTitle(page.title);
  }, [page.title]);

  const handleSave = () => {
    const trimmed = tempTitle.trim();
    if (trimmed && trimmed !== page.title) {
      onRename?.(page.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={() => onSelect(page.id)}
      className={`group/pageitem p-3 rounded-xl cursor-pointer transition select-none liquid-glass-tile onenote-page-tile relative ${
        isSelected
          ? darkMode
            ? 'bg-slate-900/80 border border-amber-500/50 text-amber-300 shadow-md font-semibold'
            : 'bg-white/95 border border-amber-500/50 text-amber-900 shadow-sm font-semibold'
          : darkMode
          ? 'hover:bg-slate-900/30 text-slate-300 border border-transparent'
          : 'hover:bg-white/60 text-slate-700 border border-transparent'
      }`}
      style={
        isSelected
          ? {
              borderColor: `${accentColor}80`,
              boxShadow: `0 0 16px ${accentColor}20`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-1">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setTempTitle(page.title);
                setIsEditing(false);
              }
            }}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs font-semibold bg-transparent border-b border-amber-400 focus:outline-none"
          />
        ) : (
          <p
            className="text-xs font-semibold truncate flex-1"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="Double-click to rename page"
          >
            {page.title}
          </p>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {!isEditing && onRename && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-80 md:opacity-0 md:group-hover/pageitem:opacity-100 p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Rename page"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(page);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-80 md:opacity-0 md:group-hover/pageitem:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
              title={`Delete page "${page.title}"`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          {isSelected && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
        <span>{page.updatedAt}</span>
        <span>{page.blocks.length} blocks</span>
      </div>
    </div>
  );
});
PageListItem.displayName = 'PageListItem';

interface OneNoteWorkspaceProps {
  notebooks: OneNoteNotebook[];
  isOpen: boolean;
  onCloseBack: () => void;
  onUpdateNotebooks: (notebooks: OneNoteNotebook[]) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
  smoothScroll?: boolean;
  standalone?: boolean;
}

export const OneNoteWorkspace: React.FC<OneNoteWorkspaceProps> = ({
  notebooks,
  isOpen,
  onCloseBack,
  onUpdateNotebooks,
  activePalette,
  darkMode,
  smoothScroll = true,
  standalone = false,
}) => {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>(notebooks[0]?.id || 'nb-1');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    notebooks[0]?.sections[0]?.id || 'sec-1'
  );
  const [selectedPageId, setSelectedPageId] = useState<string>(
    notebooks[0]?.sections[0]?.pages[0]?.id || 'page-1'
  );

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const contentInnerRef = useRef<HTMLDivElement>(null);
  const pagesScrollRef = useRef<HTMLDivElement>(null);
  const pagesInnerRef = useRef<HTMLDivElement>(null);
  const contentLenisRef = useRef<Lenis | null>(null);
  const pagesLenisRef = useRef<Lenis | null>(null);
  const notebookDropdownRef = useRef<HTMLDivElement>(null);
  const [isNotebookDropdownOpen, setIsNotebookDropdownOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isPagesSidebarCollapsed, setIsPagesSidebarCollapsed] = useState(false);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);

  // Renaming state for notebooks and sections
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingNotebookTitle, setEditingNotebookTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  const handleStartRenameNotebook = (nbId: string, currentTitle: string) => {
    setEditingNotebookId(nbId);
    setEditingNotebookTitle(currentTitle);
  };

  const handleSaveRenameNotebook = (nbId: string) => {
    const trimmed = editingNotebookTitle.trim();
    if (trimmed) {
      onUpdateNotebooks(
        notebooks.map((nb) => (nb.id === nbId ? { ...nb, title: trimmed } : nb))
      );
    }
    setEditingNotebookId(null);
  };

  const handleStartRenameSection = (secId: string, currentTitle: string) => {
    setEditingSectionId(secId);
    setEditingSectionTitle(currentTitle);
  };

  const handleSaveRenameSection = (secId: string) => {
    const trimmed = editingSectionTitle.trim();
    if (trimmed && currentNotebook) {
      onUpdateNotebooks(
        notebooks.map((nb) => {
          if (nb.id !== currentNotebook.id) return nb;
          return {
            ...nb,
            sections: nb.sections.map((sec) =>
              sec.id === secId ? { ...sec, title: trimmed } : sec
            ),
          };
        })
      );
    }
    setEditingSectionId(null);
  };

  const handleRenamePage = (pageId: string, newTitle: string) => {
    if (!currentNotebook || !currentSection) return;
    onUpdateNotebooks(
      notebooks.map((nb) => {
        if (nb.id !== currentNotebook.id) return nb;
        return {
          ...nb,
          sections: nb.sections.map((sec) => {
            if (sec.id !== currentSection.id) return sec;
            return {
              ...sec,
              pages: sec.pages.map((p) => {
                if (p.id !== pageId) return p;
                const updatedBlocks = p.blocks.map((b) =>
                  b.type === 'h1' && b.content === p.title ? { ...b, content: newTitle } : b
                );
                return { ...p, title: newTitle, updatedAt: 'Just now', blocks: updatedBlocks };
              }),
            };
          }),
        };
      })
    );
  };

  // Resize smooth scrolling whenever the left pages sidebar expands/collapses
  useEffect(() => {
    const timer = setTimeout(() => {
      pagesLenisRef.current?.resize();
      contentLenisRef.current?.resize();
    }, 320);
    return () => clearTimeout(timer);
  }, [isPagesSidebarCollapsed]);

  // Disables layout animation and spring bounce while the workspace is sliding into view
  const [isWorkspaceEntering, setIsWorkspaceEntering] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsWorkspaceEntering(true);
      const timer = setTimeout(() => {
        setIsWorkspaceEntering(false);
      }, 650);
      return () => clearTimeout(timer);
    } else {
      setIsWorkspaceEntering(false);
    }
  }, [isOpen]);

  // Real-time cursor spotlight & shine tracking for OneNote tiles (Page & Section/Insert buttons)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerMove = (e: PointerEvent) => {
      const tile = (e.target as HTMLElement | null)?.closest?.(
        '.onenote-page-tile, .onenote-section-tile'
      ) as HTMLElement | null;
      if (tile) {
        const rect = tile.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        tile.style.setProperty('--pointer-x', `${Math.round(x)}px`);
        tile.style.setProperty('--pointer-y', `${Math.round(y)}px`);
        tile.style.setProperty(
          '--pointer-ratio',
          `${Math.max(0, Math.min(1, x / rect.width))}`
        );
      }
    };

    const handlePointerOut = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.(
        '.onenote-page-tile, .onenote-section-tile'
      ) as HTMLElement | null;
      if (btn && (!e.relatedTarget || !btn.contains(e.relatedTarget as Node))) {
        btn.style.setProperty('--pointer-x', '-999px');
        btn.style.setProperty('--pointer-y', '-999px');
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
    };
  }, [isOpen]);

  // Transition counters and transition type tracker
  const [sectionChangeCount, setSectionChangeCount] = useState(0);
  const [pageChangeCount, setPageChangeCount] = useState(0);
  const [lastTransition, setLastTransition] = useState<'none' | 'section' | 'page'>('none');
  const isInitialMount = useRef(true);
  const prevSectionIdRef = useRef(selectedSectionId);
  const prevPageIdRef = useRef(selectedPageId);

  useEffect(() => {
    const isSectionChange = prevSectionIdRef.current !== selectedSectionId;
    const isPageChange = prevPageIdRef.current !== selectedPageId;

    prevSectionIdRef.current = selectedSectionId;
    prevPageIdRef.current = selectedPageId;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isSectionChange) {
      setSectionChangeCount((c) => c + 1);
      setLastTransition('section');
    } else if (isPageChange) {
      setPageChangeCount((c) => c + 1);
      setLastTransition('page');
    }
  }, [selectedSectionId, selectedPageId]);

  const currentNotebook = notebooks.find((nb) => nb.id === selectedNotebookId) || notebooks[0] || null;
  const currentSection =
    currentNotebook?.sections?.find((s) => s.id === selectedSectionId) ||
    currentNotebook?.sections?.[0] || null;
  const currentPage =
    currentSection?.pages?.find((p) => p.id === selectedPageId) || currentSection?.pages?.[0] || null;

  // Sync selected IDs if current selections don't exist in notebooks
  useEffect(() => {
    if (notebooks.length > 0) {
      const nbExists = notebooks.some((nb) => nb.id === selectedNotebookId);
      if (!nbExists) {
        const firstNb = notebooks[0];
        setSelectedNotebookId(firstNb.id);
        if (firstNb.sections?.[0]) {
          setSelectedSectionId(firstNb.sections[0].id);
          if (firstNb.sections[0].pages?.[0]) {
            setSelectedPageId(firstNb.sections[0].pages[0].id);
          }
        }
      }
    }
  }, [notebooks, selectedNotebookId]);

  // High-performance structural sharing updater for the currently active page (avoids deep JSON cloning)
  const updateCurrentPage = React.useCallback(
    (updater: (page: OneNotePage) => OneNotePage) => {
      if (!currentNotebook?.id || !currentSection?.id || !currentPage?.id) return;
      onUpdateNotebooks(
        notebooks.map((nb) => {
          if (nb.id !== currentNotebook?.id) return nb;
          return {
            ...nb,
            sections: nb.sections.map((sec) => {
              if (sec.id !== currentSection?.id) return sec;
              return {
                ...sec,
                pages: sec.pages.map((p) => {
                  if (p.id !== currentPage?.id) return p;
                  return updater(p);
                }),
              };
            }),
          };
        })
      );
    },
    [notebooks, currentNotebook?.id, currentSection?.id, currentPage?.id, onUpdateNotebooks]
  );

  // Add block to current page (starts with clean empty content and ghost placeholder text)
  const handleAddBlock = React.useCallback(
    (type: BlockType, afterBlockId?: string) => {
      if (!currentPage) return;
      const newBlockId = `b-${Date.now()}`;
      const newBlock: NoteBlock = {
        id: newBlockId,
        type,
        content:
          type === 'math'
            ? '\\operatorname{Attention}(Q, K, V) = \\operatorname{Softmax}\\left(\\frac{Q K^T}{\\sqrt{d_k}}\\right) V'
            : '',
        sideBlockName: type === 'math' ? 'Mathematical Formulation' : undefined,
        mathDescription: type === 'math' ? 'Scaled Dot-Product Attention' : undefined,
        checked: false,
        language: type === 'code' ? 'python' : undefined,
        imageUrl: type === 'image' ? '' : undefined,
        caption: type === 'image' ? '' : undefined,
        width: 100,
        height: 340,
        sideMode: 'none',
        sideBlockType: 'code',
        sideCodeLanguage: 'python',
        sideCodeContent: '',
        sideContent: '',
        tableHeaders: type === 'table' ? ['Column 1', 'Column 2', 'Column 3'] : undefined,
        tableRows:
          type === 'table'
            ? [
                ['', '', ''],
                ['', '', ''],
              ]
            : undefined,
      };

      updateCurrentPage((page) => {
        const newBlocks = [...page.blocks];
        if (afterBlockId === 'PAGE_TITLE') {
          newBlocks.unshift(newBlock);
        } else if (afterBlockId) {
          const idx = newBlocks.findIndex((b) => b.id === afterBlockId);
          if (idx !== -1) {
            newBlocks.splice(idx + 1, 0, newBlock);
          } else {
            newBlocks.push(newBlock);
          }
        } else {
          newBlocks.push(newBlock);
        }
        return {
          ...page,
          blocks: newBlocks,
          updatedAt: 'Just now',
        };
      });

      // Smooth scroll to freshly inserted block and auto-focus so user can immediately type with zero clicking
      setTimeout(() => {
        const blockEl = document.querySelector(`[data-block-id="${newBlockId}"]`) as HTMLElement | null;
        if (blockEl) {
          if (contentLenisRef.current) {
            contentLenisRef.current.scrollTo(blockEl, { offset: -120, duration: 0.6 });
          } else {
            blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          const inputEl = blockEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input:not([type="checkbox"]):not([type="file"]), textarea'
          );
          if (inputEl) {
            inputEl.focus();
            inputEl.select?.();
          }
        }
      }, 70);
    },
    [currentPage, updateCurrentPage]
  );

  const handleInsertBlockAfter = React.useCallback(
    (afterBlockId: string, type: BlockType) => {
      handleAddBlock(type, afterBlockId);
    },
    [handleAddBlock]
  );

  // Update specific fields on a block with fast shallow map (avoids deep JSON cloning)
  const handleUpdateBlock = React.useCallback(
    (blockId: string, patch: Partial<NoteBlock>) => {
      updateCurrentPage((page) => ({
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  // Smooth reordering of blocks with spring physics
  const handleReorderBlocks = React.useCallback(
    (newBlocks: NoteBlock[]) => {
      updateCurrentPage((page) => ({
        ...page,
        blocks: newBlocks,
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  const handleUpdateBlockContent = React.useCallback(
    (blockId: string, content: string) => {
      updateCurrentPage((page) => ({
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, content } : b)),
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  const handleToggleTodo = React.useCallback(
    (blockId: string) => {
      updateCurrentPage((page) => ({
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, checked: !b.checked } : b)),
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  const handleDeleteBlock = React.useCallback(
    (blockId: string) => {
      updateCurrentPage((page) => ({
        ...page,
        blocks: page.blocks.filter((b) => b.id !== blockId),
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  const handleUpdatePageTitle = React.useCallback(
    (newTitle: string) => {
      updateCurrentPage((page) => ({
        ...page,
        title: newTitle,
        updatedAt: 'Just now',
      }));
    },
    [updateCurrentPage]
  );

  const handleSelectPage = React.useCallback((pageId: string) => {
    setSelectedPageId(pageId);
  }, []);

  // Add new Notebook with rich defaults
  const handleAddNotebook = React.useCallback(() => {
    const newNbId = `nb-${Date.now()}`;
    const newSecId = `sec-${Date.now()}`;
    const newPageId = `p-${Date.now()}`;
    const count = notebooks.length + 1;
    const newNotebook: OneNoteNotebook = {
      id: newNbId,
      title: `Notebook ${count}`,
      description: 'Custom research and workspace notes',
      sections: [
        {
          id: newSecId,
          title: '01. Overview',
          color: activePalette.primary || '#f59e0b',
          pages: [
            {
              id: newPageId,
              title: 'Getting Started',
              updatedAt: 'Just now',
              blocks: [
                { id: `b-${Date.now()}`, type: 'h1', content: `Notebook ${count}` },
                { id: `b-${Date.now() + 1}`, type: 'paragraph', content: 'Draft your ideas, equations, code, and source notes here.' },
              ],
            },
          ],
        },
      ],
    };

    onUpdateNotebooks([...notebooks, newNotebook]);
    setSelectedNotebookId(newNbId);
    setSelectedSectionId(newSecId);
    setSelectedPageId(newPageId);
    setIsNotebookDropdownOpen(false);
  }, [notebooks, activePalette.primary, onUpdateNotebooks]);

  // Add new Section with fast immutable update
  const handleAddSection = React.useCallback(() => {
    let targetNotebook = currentNotebook;
    if (!targetNotebook) {
      if (notebooks.length > 0) {
        targetNotebook = notebooks[0];
      } else {
        handleAddNotebook();
        return;
      }
    }
    const targetNotebookId = targetNotebook.id;
    const colors = ['#f59e0b', '#dc2626', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const secCount = (targetNotebook.sections?.length || 0) + 1;
    const padNum = secCount < 10 ? `0${secCount}` : `${secCount}`;
    const title = `${padNum}. New Section`;

    const newSecId = `sec-${Date.now()}`;
    const newPageId = `p-${Date.now()}`;
    const newSec: OneNoteSection = {
      id: newSecId,
      title,
      color: randomColor,
      pages: [
        {
          id: newPageId,
          title: 'Untitled Page',
          updatedAt: 'Just now',
          blocks: [
            { id: `b-${Date.now()}`, type: 'h1', content: title },
            { id: `b-${Date.now() + 1}`, type: 'paragraph', content: '' },
          ],
        },
      ],
    };

    onUpdateNotebooks(
      notebooks.map((nb) =>
        nb.id === targetNotebookId
          ? { ...nb, sections: [...(nb.sections || []), newSec] }
          : nb
      )
    );
    setSelectedNotebookId(targetNotebookId);
    setSelectedSectionId(newSecId);
    setSelectedPageId(newPageId);
  }, [notebooks, currentNotebook, handleAddNotebook, onUpdateNotebooks]);

  // Notebook, Section & Page deletion state (full-viewport confirmation modals)
  const [notebookToDelete, setNotebookToDelete] = useState<OneNoteNotebook | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<OneNoteSection | null>(null);
  const [pageToDelete, setPageToDelete] = useState<OneNotePage | null>(null);

  // Right-click formatting context menu state
  const [blockContextMenu, setBlockContextMenu] = useState<{
    x: number;
    y: number;
    block: NoteBlock;
  } | null>(null);

  // Close context menu on outside click or escape key
  useEffect(() => {
    if (!blockContextMenu) return;
    const handleClose = () => setBlockContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlockContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, [blockContextMenu]);

  const handleBlockContextMenu = useCallback((e: React.MouseEvent, block: NoteBlock) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 380);
    setBlockContextMenu({ x, y, block });
  }, []);

  const handleFormatBold = (block: NoteBlock) => {
    let content = block.content || '';
    if (content.startsWith('**') && content.endsWith('**') && content.length >= 4) {
      content = content.slice(2, -2);
    } else {
      content = `**${content}**`;
    }
    handleUpdateBlockContent(block.id, content);
    setBlockContextMenu(null);
  };

  const handleFormatItalic = (block: NoteBlock) => {
    let content = block.content || '';
    if (content.startsWith('*') && content.endsWith('*') && content.length >= 2) {
      content = content.slice(1, -1);
    } else {
      content = `*${content}*`;
    }
    handleUpdateBlockContent(block.id, content);
    setBlockContextMenu(null);
  };

  const handleFormatCode = (block: NoteBlock) => {
    let content = block.content || '';
    if (content.startsWith('`') && content.endsWith('`') && content.length >= 2) {
      content = content.slice(1, -1);
    } else {
      content = `\`${content}\``;
    }
    handleUpdateBlockContent(block.id, content);
    setBlockContextMenu(null);
  };

  const handleConvertBlockType = (block: NoteBlock, newType: BlockType) => {
    handleUpdateBlock(block.id, { type: newType });
    setBlockContextMenu(null);
  };

  const handleChangeIndent = (block: NoteBlock, delta: number) => {
    const newIndent = Math.max(0, Math.min(6, (block.indent || 0) + delta));
    handleUpdateBlock(block.id, { indent: newIndent });
    setBlockContextMenu(null);
  };

  const handleConfirmDeleteSection = () => {
    if (!sectionToDelete || !currentNotebook) return;
    const remaining = currentNotebook.sections.filter((s) => s.id !== sectionToDelete.id);
    let finalSections = remaining;
    let newSecId = selectedSectionId;
    let newPageId = selectedPageId;

    if (finalSections.length === 0) {
      const fallbackSecId = `sec-${Date.now()}`;
      const fallbackPageId = `p-${Date.now()}`;
      finalSections = [
        {
          id: fallbackSecId,
          title: '01. Notes',
          color: activePalette.primary || '#f59e0b',
          pages: [
            {
              id: fallbackPageId,
              title: 'Untitled Page',
              updatedAt: 'Just now',
              blocks: [
                { id: `b-${Date.now()}`, type: 'h1', content: 'Notes' },
                { id: `b-${Date.now() + 1}`, type: 'paragraph', content: '' },
              ],
            },
          ],
        },
      ];
      newSecId = fallbackSecId;
      newPageId = fallbackPageId;
    } else if (selectedSectionId === sectionToDelete.id) {
      newSecId = finalSections[0].id;
      newPageId = finalSections[0].pages[0]?.id || '';
    }

    onUpdateNotebooks(
      notebooks.map((nb) =>
        nb.id === currentNotebook.id ? { ...nb, sections: finalSections } : nb
      )
    );
    setSelectedSectionId(newSecId);
    setSelectedPageId(newPageId);
    setSectionToDelete(null);
  };

  const handleConfirmDeletePage = () => {
    if (!pageToDelete || !currentNotebook || !currentSection) return;
    const remaining = currentSection.pages.filter((p) => p.id !== pageToDelete.id);
    let finalPages = remaining;
    let newPageId = selectedPageId;

    if (finalPages.length === 0) {
      const fallbackPageId = `p-${Date.now()}`;
      finalPages = [
        {
          id: fallbackPageId,
          title: 'Untitled Page',
          updatedAt: 'Just now',
          blocks: [
            { id: `b-${Date.now()}`, type: 'h1', content: 'Untitled Page' },
            { id: `b-${Date.now() + 1}`, type: 'paragraph', content: '' },
          ],
        },
      ];
      newPageId = fallbackPageId;
    } else if (selectedPageId === pageToDelete.id) {
      newPageId = finalPages[0].id;
    }

    onUpdateNotebooks(
      notebooks.map((nb) => {
        if (nb.id !== currentNotebook.id) return nb;
        return {
          ...nb,
          sections: nb.sections.map((sec) => {
            if (sec.id !== currentSection.id) return sec;
            return { ...sec, pages: finalPages };
          }),
        };
      })
    );
    setSelectedPageId(newPageId);
    setPageToDelete(null);
  };

  const handleConfirmDeleteNotebook = () => {
    if (!notebookToDelete) return;
    const remaining = notebooks.filter((nb) => nb.id !== notebookToDelete.id);
    let finalNotebooks = remaining;
    let newNotebookId = selectedNotebookId;

    if (finalNotebooks.length === 0) {
      const fallbackNbId = `nb-${Date.now()}`;
      const fallbackSecId = `sec-${Date.now()}`;
      const fallbackPageId = `page-${Date.now()}`;
      finalNotebooks = [
        {
          id: fallbackNbId,
          title: 'Notebook 1',
          description: 'Primary Notebook',
          sections: [
            {
              id: fallbackSecId,
              title: '01. New Section',
              color: 'from-amber-400 to-amber-600',
              pages: [
                {
                  id: fallbackPageId,
                  title: 'Untitled Page',
                  updatedAt: 'Just now',
                  blocks: [
                    { id: `b-${Date.now()}`, type: 'h1', content: 'Untitled Page' },
                    { id: `b-${Date.now() + 1}`, type: 'paragraph', content: '' },
                  ],
                },
              ],
            },
          ],
        },
      ];
      newNotebookId = fallbackNbId;
      setSelectedSectionId(fallbackSecId);
      setSelectedPageId(fallbackPageId);
    } else if (selectedNotebookId === notebookToDelete.id) {
      newNotebookId = finalNotebooks[0].id;
      setSelectedSectionId(finalNotebooks[0].sections[0]?.id || '');
      setSelectedPageId(finalNotebooks[0].sections[0]?.pages[0]?.id || '');
    }

    onUpdateNotebooks(finalNotebooks);
    setSelectedNotebookId(newNotebookId);
    setNotebookToDelete(null);
  };

  const handleReorderSections = (newSections: OneNoteSection[]) => {
    if (!currentNotebook) return;
    onUpdateNotebooks(
      notebooks.map((nb) =>
        nb.id === currentNotebook.id ? { ...nb, sections: newSections } : nb
      )
    );
  };

  const handleReorderPages = (newPages: OneNotePage[]) => {
    if (!currentNotebook || !currentSection) return;
    onUpdateNotebooks(
      notebooks.map((nb) => {
        if (nb.id !== currentNotebook.id) return nb;
        return {
          ...nb,
          sections: nb.sections.map((sec) =>
            sec.id === currentSection.id ? { ...sec, pages: newPages } : sec
          ),
        };
      })
    );
  };

  // Add new Page with fast immutable update (no window.prompt to avoid iFrame freezing)
  const handleAddPage = React.useCallback(() => {
    if (!currentNotebook?.id || !currentSection?.id) return;
    const count = (currentSection.pages?.length || 0) + 1;
    const title = `Untitled Page ${count}`;

    const newPageId = `page-${Date.now()}`;
    const newP: OneNotePage = {
      id: newPageId,
      title,
      updatedAt: 'Just now',
      blocks: [
        { id: `b-${Date.now()}`, type: 'h1', content: title },
        { id: `b-${Date.now() + 1}`, type: 'paragraph', content: '' },
      ],
    };

    onUpdateNotebooks(
      notebooks.map((nb) => {
        if (nb.id !== currentNotebook.id) return nb;
        return {
          ...nb,
          sections: nb.sections.map((sec) => {
            if (sec.id !== currentSection.id) return sec;
            return {
              ...sec,
              pages: [...sec.pages, newP],
            };
          }),
        };
      })
    );
    setSelectedPageId(newPageId);
  }, [notebooks, currentNotebook?.id, currentSection?.id, onUpdateNotebooks]);

  const handleCopyPageText = () => {
    if (!currentPage) return;
    const text = currentPage.blocks.map((b) => b.content).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleToggleNotebookDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNotebookDropdownOpen((prev) => !prev);
  };

  // Close notebook dropdown on outside click
  useEffect(() => {
    if (!isNotebookDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notebookDropdownRef.current && !notebookDropdownRef.current.contains(target)) {
        setIsNotebookDropdownOpen(false);
        setEditingNotebookId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotebookDropdownOpen]);

  // Escape key listener for quick Hyprland-style workspace return or closing dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isNotebookDropdownOpen) {
          setIsNotebookDropdownOpen(false);
          return;
        }
        if (!standalone) {
          onCloseBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCloseBack, isNotebookDropdownOpen, standalone]);

  // Smooth Momentum Scrolling for OneNote Workspace via Lenis
  useEffect(() => {
    if (!isOpen || !smoothScroll) return;

    if (contentScrollRef.current && contentInnerRef.current) {
      const lenis = new Lenis({
        wrapper: contentScrollRef.current,
        content: contentInnerRef.current,
        autoRaf: true,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.0,
        lerp: 0.09, // Pure, uninterrupted liquid momentum
        infinite: false,
        autoResize: true,
        overscroll: true,
        respectReducedMotion: false,
        prevent: (node: HTMLElement) => {
          return (
            node.hasAttribute('data-lenis-prevent') ||
            node.classList.contains('lenis-prevent') ||
            node.tagName === 'SELECT'
          );
        },
      });
      contentLenisRef.current = lenis;
      lenis.resize();
    }

    if (pagesScrollRef.current && pagesInnerRef.current) {
      const pLenis = new Lenis({
        wrapper: pagesScrollRef.current,
        content: pagesInnerRef.current,
        autoRaf: true,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.0,
        lerp: 0.09,
        infinite: false,
        autoResize: true,
        overscroll: true,
        respectReducedMotion: false,
      });
      pagesLenisRef.current = pLenis;
      pLenis.resize();
    }

    return () => {
      contentLenisRef.current?.destroy();
      contentLenisRef.current = null;
      pagesLenisRef.current?.destroy();
      pagesLenisRef.current = null;
    };
  }, [isOpen, smoothScroll]);

  // Reset scroll position to top and re-sync Lenis when page changes
  useEffect(() => {
    if (contentLenisRef.current) {
      contentLenisRef.current.scrollTo(0, { immediate: true });
      contentLenisRef.current.resize();
    } else if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [selectedPageId, selectedSectionId]);

  // Keep Lenis scroll limits synchronized with dynamic block content growth
  useEffect(() => {
    if (contentLenisRef.current) {
      contentLenisRef.current.resize();
    }
  }, [currentPage?.blocks.length]);

  return (
    <div
      aria-hidden={!isOpen}
      className={`${
        standalone
          ? 'relative flex-1 min-h-0 w-full h-full flex overflow-hidden pt-12 pb-16 md:pt-0 md:pb-0'
          : `fixed inset-0 z-50 h-[100dvh] md:h-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] md:pt-0 md:pb-0 flex hyprland-slide ${
              isOpen
                ? 'translate-x-0 opacity-100 pointer-events-auto visible frost-edge'
                : 'translate-x-[100%] opacity-0 pointer-events-none invisible'
            }`
      } ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}
      style={standalone ? undefined : { backgroundColor: darkMode ? activePalette.bgDark : '#f8fafc' }}
    >
      {/* FAINTED ARROW ON THE LEFT (HYPRLAND BACK TRIGGER - omitted in standalone OneNote workspaces and mobile <768px) */}
      {!standalone && (
        <div className="hidden md:block relative group shrink-0 z-50">
          <button
            onClick={onCloseBack}
            aria-label="Return to Primary Workspace"
            className={`h-full w-11 sm:w-12 border-r flex flex-col items-center justify-center gap-3.5 opacity-70 hover:opacity-100 transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-2xl group ${
              darkMode
                ? 'bg-slate-900/40 hover:bg-slate-900/80 border-white/15'
                : 'bg-white/50 hover:bg-white/90 border-slate-300/80 shadow-slate-300/40'
            }`}
            style={{ color: activePalette.primary }}
            title="Click to glide back to main workspace (or press Esc)"
          >
            <div
              className="p-1 rounded-full border group-hover:scale-110 transition-transform duration-300 shadow-sm flex items-center justify-center"
              style={{
                backgroundColor: `${activePalette.primary}25`,
                borderColor: `${activePalette.primary}60`,
              }}
            >
              <ChevronLeft className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <span
              className={`[writing-mode:vertical-rl] rotate-180 text-[10px] font-mono tracking-widest uppercase font-bold transition-colors ${
                darkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-950'
              }`}
            >
              Workspace
            </span>
            <span
              className={`text-[9px] font-mono px-1 py-0.5 rounded border [writing-mode:vertical-rl] rotate-180 opacity-60 group-hover:opacity-100 transition ${
                darkMode ? 'border-white/20 text-slate-400' : 'border-slate-400/30 text-slate-600'
              }`}
            >
              Esc
            </span>
          </button>
        </div>
      )}

      {/* ONENOTE FULLSCREEN SUITE CONTAINER */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative onenote-main-workspace ${
          standalone ? '' : 'bg-topo'
        }`}
      >
        {/* Top OneNote App Bar & Section Tabs (Distinct Floating Liquid Glass Tile) */}
        <div
          className="mx-2 md:mx-3 mt-2 md:mt-3 mb-0 rounded-2xl liquid-glass no-lift border border-white/10 px-2.5 md:px-4 py-2 flex items-center justify-between gap-2 md:gap-3 shrink-0 min-h-[48px] md:min-h-[50px] shadow-xl relative z-[150]"
          style={{ isolation: 'auto' }}
        >
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {/* Mobile Pages Drawer Trigger (< 768px ONLY) */}
            <button
              type="button"
              onClick={() => setMobilePagesOpen(true)}
              className={`md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold shrink-0 ${
                darkMode
                  ? 'bg-slate-900/50 border-white/15 text-slate-200'
                  : 'bg-white/80 border-slate-300 text-slate-800 shadow-xs'
              }`}
              aria-label="Open Pages Drawer"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
              <span>Pages</span>
            </button>

            {/* Custom Webpage-Fitted Liquid Glass Notebook Dropdown Container */}
            <div ref={notebookDropdownRef} className="relative shrink-0 z-[200]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleNotebookDropdown}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition select-none liquid-glass-tile cursor-pointer ${
                    isNotebookDropdownOpen
                      ? darkMode
                        ? 'border-white/30 bg-slate-900/70 text-white shadow-md'
                        : 'border-slate-300 bg-white/90 text-slate-900 shadow-md'
                      : darkMode
                      ? 'bg-slate-900/20 border-white/10 text-slate-200 hover:border-white/25 hover:bg-slate-900/40'
                      : 'bg-white/40 border-slate-200/80 text-slate-800 hover:border-slate-300 hover:bg-white/70 shadow-sm'
                  }`}
                  style={
                    isNotebookDropdownOpen
                      ? {
                          borderColor: `${activePalette.primary}60`,
                          boxShadow: `0 0 14px ${activePalette.primary}25`,
                        }
                      : undefined
                  }
                >
                  <Book
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: activePalette.primary }}
                  />
                  <span className="truncate max-w-[140px] sm:max-w-[200px] font-bold">
                    {currentNotebook?.title || 'Select Notebook'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 text-slate-400 shrink-0 ${
                      isNotebookDropdownOpen ? 'rotate-180' : ''
                    }`}
                    style={{
                      color: isNotebookDropdownOpen ? activePalette.primary : undefined,
                    }}
                  />
                </button>
              </div>

              {/* Floating Dropdown Popover (Positioned absolutely right below trigger with top layering) */}
              {isNotebookDropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-[320px] md:w-auto md:min-w-[280px] md:max-w-sm rounded-2xl border p-2 shadow-2xl z-[300] select-none ${
                    darkMode
                      ? 'border-white/15 bg-slate-950/95 shadow-black/80 text-slate-200'
                      : 'border-slate-200 bg-white/95 shadow-slate-900/25 text-slate-800'
                  }`}
                  style={{
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                  }}
                >
                  <div className="px-2.5 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="uppercase tracking-wider font-semibold">Notebooks</span>
                    <span>{notebooks.length} total</span>
                  </div>

                  <Reorder.Group
                    axis="y"
                    values={notebooks}
                    onReorder={onUpdateNotebooks}
                    layoutScroll
                    className="space-y-1 max-h-64 overflow-y-auto no-scrollbar"
                  >
                    {notebooks.map((nb) => {
                      const isSelected = nb.id === selectedNotebookId;
                      const isEditing = editingNotebookId === nb.id;

                      return (
                        <Reorder.Item
                          key={nb.id}
                          value={nb}
                          dragElastic={0.1}
                          dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                          whileDrag={{
                            scale: 1.02,
                            zIndex: 60,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                          }}
                          className={`w-full px-2.5 py-2 rounded-xl transition-colors duration-150 flex items-center justify-between gap-2.5 text-xs select-none border border-transparent group/nbitem cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? darkMode
                                ? 'bg-white/10 text-white font-bold'
                                : 'bg-slate-100 text-slate-950 font-bold'
                              : darkMode
                              ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                          }`}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: `${activePalette.primary}20`,
                                  color: darkMode ? '#ffffff' : activePalette.primary,
                                }
                              : undefined
                          }
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingNotebookTitle}
                              onChange={(e) => setEditingNotebookTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameNotebook(nb.id);
                                if (e.key === 'Escape') setEditingNotebookId(null);
                              }}
                              onBlur={() => handleSaveRenameNotebook(nb.id)}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 text-xs font-semibold rounded bg-white/10 border border-amber-400 focus:outline-none"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setSelectedNotebookId(nb.id);
                                setIsNotebookDropdownOpen(false);
                                const targetSec = nb.sections && nb.sections.length > 0 ? nb.sections[0] : null;
                                if (targetSec) {
                                  setSelectedSectionId(targetSec.id);
                                  if (targetSec.pages && targetSec.pages.length > 0) {
                                    setSelectedPageId(targetSec.pages[0].id);
                                  }
                                }
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                            >
                              <Book
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: isSelected ? activePalette.primary : undefined }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">{nb.title}</p>
                                <span className="text-[10px] opacity-60 font-mono block">
                                  {nb.sections.length} sections
                                </span>
                              </div>
                            </div>
                          )}

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => handleStartRenameNotebook(nb.id, nb.title)}
                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white opacity-80 md:opacity-0 md:group-hover/nbitem:opacity-100 transition cursor-pointer"
                                title="Rename notebook"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => setNotebookToDelete(nb)}
                                className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 opacity-80 md:opacity-0 md:group-hover/nbitem:opacity-100 transition cursor-pointer"
                                title={`Delete notebook "${nb.title}"`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {isSelected && (
                              <Check
                                className="w-3.5 h-3.5 shrink-0 stroke-[2.5]"
                                style={{ color: activePalette.primary }}
                              />
                            )}
                          </div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>

                  {/* Create New Notebook Action */}
                  <div className={`p-2 border-t ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={handleAddNotebook}
                      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                        darkMode
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" style={{ color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary }} />
                      <span>Create Notebook</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-white/10 shrink-0" />

            {/* OneNote Color-Coded Section Tabs (Interactable Liquid Glass Tiles with Drag-and-Drop Reordering) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1 py-1">
              <Reorder.Group
                axis="x"
                values={currentNotebook?.sections || []}
                onReorder={handleReorderSections}
                className="flex items-center gap-1.5 min-w-0 shrink-0"
              >
                {currentNotebook?.sections.map((section) => {
                  const isSelected = selectedSectionId === section.id;
                  const isEditing = editingSectionId === section.id;

                  return (
                    <Reorder.Item
                      key={section.id}
                      value={section}
                      dragElastic={0.1}
                      dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                      whileDrag={{
                        scale: 1.05,
                        zIndex: 60,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      }}
                      className="relative group/sectab flex items-center shrink-0 cursor-grab active:cursor-grabbing select-none"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          if (section.pages[0]) setSelectedPageId(section.pages[0].id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors duration-150 flex items-center gap-2 whitespace-nowrap select-none liquid-glass-tile onenote-section-tile cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? darkMode
                                ? 'bg-slate-900/90 text-slate-100 shadow-md border'
                                : 'bg-white text-slate-900 shadow-sm border'
                              : darkMode
                              ? 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                              : 'text-slate-600 hover:text-slate-950 hover:bg-white/60 border border-transparent'
                          }`}
                          style={{
                            borderColor: isSelected ? section.color : undefined,
                            boxShadow: isSelected ? `0 0 14px ${section.color}35` : undefined,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-xs pointer-events-none"
                            style={{ backgroundColor: section.color }}
                          />
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingSectionTitle}
                              onChange={(e) => setEditingSectionTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameSection(section.id);
                                if (e.key === 'Escape') setEditingSectionId(null);
                              }}
                              onBlur={() => handleSaveRenameSection(section.id)}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="text-xs font-semibold bg-transparent border-b border-amber-400 focus:outline-none max-w-[120px]"
                            />
                          ) : (
                            <span
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartRenameSection(section.id, section.title);
                              }}
                              title="Double-click to rename section"
                            >
                              {section.title}
                            </span>
                          )}

                          {!isEditing && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRenameSection(section.id, section.title);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="opacity-80 md:opacity-0 md:group-hover/sectab:opacity-100 p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                              title="Rename section"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </span>
                          )}

                          {(currentNotebook?.sections?.length || 0) > 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSectionToDelete(section);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="opacity-80 md:opacity-0 md:group-hover/sectab:opacity-100 p-0.5 ml-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              title={`Delete section "${section.title}"`}
                            >
                              <X className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      </Reorder.Item>
                    );
                  })}
              </Reorder.Group>

              <button
                onClick={handleAddSection}
                className={`px-2.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border cursor-pointer ${
                  darkMode ? 'text-slate-200 hover:text-white hover:bg-white/10 border-white/15' : 'text-slate-700 hover:text-slate-950 hover:bg-white/80 border-slate-300'
                }`}
                title="Add new section tab"
              >
                <Plus className="w-3.5 h-3.5" style={{ color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary }} />
                <span className="text-[11px] font-bold">Section</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          {!standalone && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onCloseBack}
                className={`px-2.5 md:px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1 ${
                  darkMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-amber-500/15 text-amber-900 border-amber-500/40 hover:bg-amber-500/25 shadow-sm'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5 md:hidden" />
                <span className="hidden md:inline">Back to Workspace</span>
                <span className="md:hidden">Back</span>
              </button>
            </div>
          )}
        </div>

        {/* 2-Column Body: Pages Navigation (Page Tile) + Rich Block Canvas (Main Body Tile) */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative z-10 pt-2 sm:pt-2.5">
          {/* Glow frost blur animation on section switch (covers Page Tile + Main Body Tile only, top bar is unblurred) */}
          {sectionChangeCount > 0 && (
            <div
              key={`section-frost-${sectionChangeCount}`}
              className="absolute inset-0 z-40 pointer-events-none onenote-glow-frost-sweep"
              style={{
                ['--section-glow-color' as any]: currentSection?.color || activePalette.primary,
              }}
              aria-hidden="true"
            />
          )}

          {/* ANDROID / MOBILE SLIDE-OVER PAGES DRAWER (< 768px ONLY) */}
          <AnimatePresence>
            {mobilePagesOpen && (
              <div className="fixed inset-0 z-[220] md:hidden flex">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMobilePagesOpen(false)}
                  className="fixed inset-0 bg-black/65 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  className={`relative z-10 w-[82vw] max-w-[300px] h-full flex flex-col border-r shadow-2xl pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] ${
                    darkMode
                      ? 'bg-slate-950/95 border-white/15 text-slate-200'
                      : 'bg-white/95 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Pages ({currentSection?.pages.length || 0})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleAddPage}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Page</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobilePagesOpen(false)}
                        className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                        aria-label="Close Pages Drawer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                    {currentSection?.pages.map((page) => (
                      <PageListItem
                        key={page.id}
                        page={page}
                        isSelected={selectedPageId === page.id}
                        darkMode={darkMode}
                        accentColor={currentSection?.color || activePalette.primary}
                        onSelect={(id) => {
                          handleSelectPage(id);
                          setMobilePagesOpen(false);
                        }}
                        onDelete={(p) => setPageToDelete(p)}
                        onRename={handleRenamePage}
                      />
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Interactive Liquid Glass Pages Sidebar Tile (Desktop >= 768px) */}
          <div
            className={`hidden md:flex relative shrink-0 liquid-glass rounded-2xl border shadow-xl flex-col overflow-hidden z-20 ml-2.5 sm:ml-3 mb-2.5 sm:mb-3 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
              isPagesSidebarCollapsed ? 'w-12 sm:w-14' : 'w-64 sm:w-72'
            } ${
              darkMode
                ? 'border-white/15 bg-slate-900/60 shadow-black/50 text-slate-200'
                : 'border-slate-300/80 bg-white/85 shadow-slate-300/50 text-slate-800'
            }`}
            style={{
              contain: 'paint',
            }}
          >
            {/* Minimized Compact Interactive Rail with Indexed Page Bubbles (Hardware-Accelerated Zero Reflow) */}
            <div
              className={`absolute inset-0 w-12 sm:w-14 flex flex-col items-center justify-between py-3 px-1 select-none transition-opacity duration-200 ${
                isPagesSidebarCollapsed
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
                {/* Top Action: Expand Button & Add Page */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPagesSidebarCollapsed(false)}
                    className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition shadow-sm hover:scale-105 cursor-pointer"
                    title="Expand Pages Sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleAddPage}
                    className="p-1.5 rounded-lg border border-white/10 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 hover:bg-white/5 transition cursor-pointer"
                    title="Add new page"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtle Divider */}
                <div className="w-6 h-px bg-white/10 my-2 shrink-0" />

                {/* Scrollable Indexed Page Bubbles */}
                <Reorder.Group
                  axis="y"
                  values={currentSection?.pages || []}
                  onReorder={handleReorderPages}
                  layoutScroll
                  className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 py-1"
                >
                  {currentSection?.pages.map((page, index) => (
                    <Reorder.Item
                      key={page.id}
                      value={page}
                      dragElastic={0.1}
                      dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                      whileDrag={{ scale: 1.08, zIndex: 60 }}
                      className="cursor-grab active:cursor-grabbing select-none"
                    >
                      <PageBubbleItem
                        page={page}
                        pageNumber={index + 1}
                        isSelected={selectedPageId === page.id}
                        darkMode={darkMode}
                        accentColor={currentSection?.color || activePalette.primary}
                        onSelect={handleSelectPage}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                {/* Subtle Divider */}
                <div className="w-6 h-px bg-white/10 my-2 shrink-0" />

                {/* Bottom Total Pages Bubble / Indicator */}
                <button
                  type="button"
                  onClick={() => setIsPagesSidebarCollapsed(false)}
                  className={`w-full py-1 text-[9px] font-mono rounded-lg border flex flex-col items-center justify-center transition cursor-pointer select-none shrink-0 ${
                    darkMode
                      ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                      : 'border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-black/5'
                  }`}
                  title="Click to expand full sidebar"
                >
                  <span className="font-bold">{currentSection?.pages.length || 0} pgs</span>
                </button>
            </div>

            {/* Expanded Full Liquid Glass Sidebar Content (Fixed Natural Width - Zero Reflow Churn) */}
            <div
              className={`absolute inset-0 w-64 sm:w-72 flex flex-col transition-opacity duration-200 ${
                isPagesSidebarCollapsed
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-100 pointer-events-auto'
              }`}
            >
                {/* Tile Header */}
                <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 select-none shrink-0 bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                      Pages ({currentSection?.pages.length || 0})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleAddPage}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer select-none liquid-glass-tile onenote-page-tile"
                      title="Create a new page in this section"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Page</span>
                    </button>

                    {/* Minimize Button */}
                    <button
                      type="button"
                      onClick={() => setIsPagesSidebarCollapsed(true)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        darkMode
                          ? 'border-white/10 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white'
                          : 'border-slate-300/70 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-950 shadow-sm'
                      }`}
                      title="Minimize left sidebar (expand widescreen editor)"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Pages List */}
                <div
                  ref={pagesScrollRef}
                  className="flex-1 overflow-y-auto p-2 [scroll-behavior:auto] overscroll-contain space-y-1.5 custom-scrollbar"
                >
                  <div ref={pagesInnerRef} className="space-y-1.5">
                    <div
                      key={selectedSectionId}
                      className={`space-y-1.5 ${
                        lastTransition === 'section' ? 'onenote-section-content-reveal' : ''
                      }`}
                    >
                      <Reorder.Group
                        axis="y"
                        values={currentSection?.pages || []}
                        onReorder={handleReorderPages}
                        layoutScroll
                        className="space-y-1.5"
                      >
                        {currentSection?.pages.map((page) => (
                          <Reorder.Item
                            key={page.id}
                            value={page}
                            dragElastic={0.1}
                            dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                            whileDrag={{
                              scale: 1.02,
                              zIndex: 60,
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                            }}
                            className="cursor-grab active:cursor-grabbing select-none"
                          >
                            <PageListItem
                              page={page}
                              isSelected={selectedPageId === page.id}
                              darkMode={darkMode}
                              accentColor={currentSection?.color || activePalette.primary}
                              onSelect={handleSelectPage}
                              onDelete={(p) => setPageToDelete(p)}
                              onRename={handleRenamePage}
                            />
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* Rich Block Editor Canvas */}
          <div
            className={`flex-1 min-h-0 flex flex-col overflow-hidden relative onenote-canvas-stage ${
              darkMode ? 'bg-transparent' : 'bg-transparent'
            }`}
          >
            {/* Block Insert Toolbar (Styled with liquid-glass and section-tile button glows) */}
            <div
              className={`mx-2.5 sm:mx-3 mt-0 mb-2 rounded-2xl liquid-glass border px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 relative z-20 shadow-xl ${
                darkMode
                  ? 'border-white/10 bg-slate-900/50 shadow-black/30'
                  : 'border-slate-200/80 bg-white/80 shadow-slate-200/40'
              }`}
            >
              <span
                className={`text-[11px] font-mono uppercase tracking-wider pr-2 font-semibold shrink-0 select-none ${
                  darkMode ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Insert Block:
              </span>
              <button
                type="button"
                onClick={() => handleAddBlock('h1')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <Heading1 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Heading 1</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('h2')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <Heading2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Heading 2</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('paragraph')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <Type className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('todo')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>To-Do</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('code')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span>Code Block</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('image')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-white hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
                title="Insert resizable image tile or parallel code diagram"
              >
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className={darkMode ? 'text-white' : 'text-slate-800'}>Image Tile</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('callout')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Callout</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('quote')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-slate-300 hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
              >
                <Quote className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Quote</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('table')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-white hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
                title="Insert interactive table (or press Tab in workspace)"
              >
                <TableIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className={darkMode ? 'text-white' : 'text-slate-800'}>Table</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('math')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0 select-none liquid-glass-tile onenote-section-tile border ${
                  darkMode
                    ? 'text-white hover:text-white hover:bg-slate-900/40 border-white/5 hover:border-white/20'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-white/60 border-slate-200/90 shadow-xs'
                }`}
                title="Insert mathematical formula or LaTeX equation"
              >
                <Sigma className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className={darkMode ? 'text-white' : 'text-slate-800'}>Math</span>
              </button>
            </div>

            {/* Editable Content Stream (Spacious 16:9 widescreen canvas) */}
            <div className="relative flex-1 min-h-0 overflow-hidden w-full">
              {/* Blur animation on page change (strictly note body, never insert block) */}
              {pageChangeCount > 0 && (
                <div
                  key={`page-blur-${pageChangeCount}`}
                  className="absolute inset-0 z-30 pointer-events-none onenote-page-blur-sweep"
                  aria-hidden="true"
                />
              )}
              <div
                ref={contentScrollRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden [scroll-behavior:auto] overscroll-contain onenote-editor-canvas"
              >
              <div
                ref={contentInnerRef}
                className="max-w-5xl xl:max-w-6xl mx-auto p-3.5 md:p-10 space-y-4 pb-24 md:pb-28"
              >
                <div
                  key={`${selectedSectionId}-${selectedPageId}`}
                  className={`space-y-4 ${
                    lastTransition === 'section'
                      ? 'onenote-section-content-reveal'
                      : lastTransition === 'page'
                      ? 'onenote-page-content-reveal'
                      : ''
                  }`}
                >
                  {!currentNotebook ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
                        style={{
                          backgroundColor: `${activePalette.primary}15`,
                          borderColor: `${activePalette.primary}35`,
                        }}
                      >
                        <Book className="w-7 h-7" style={{ color: activePalette.primary }} />
                      </div>
                      <h3 className={`text-lg font-bold mb-1.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        No Notebook in this Workspace
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mb-5">
                        Each workspace maintains exclusive notebooks. Create your first notebook to begin drafting.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddNotebook}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg hover:scale-105 active:scale-95"
                        style={{
                          backgroundColor: activePalette.primary,
                          color: '#ffffff',
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Notebook</span>
                      </button>
                    </div>
                  ) : currentPage ? (
                    <>
                      {/* Page Title */}
                      <input
                        type="text"
                        value={currentPage.title}
                        onChange={(e) => handleUpdatePageTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            e.preventDefault();
                            handleAddBlock('table', 'PAGE_TITLE');
                          }
                        }}
                        className={`w-full text-2xl sm:text-4xl font-extrabold bg-transparent border-b border-transparent focus:outline-none pb-2 transition ${
                          darkMode
                            ? 'text-slate-100 hover:border-white/20 focus:border-amber-500'
                            : 'text-slate-900 hover:border-slate-300 focus:border-amber-500'
                        }`}
                        placeholder="Page Title..."
                      />

                      <div
                        className={`text-xs font-mono pb-4 flex items-center gap-2 ${
                          darkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        <span>Last modified: {currentPage.updatedAt}</span>
                        <span>·</span>
                        <span>{currentPage.blocks.length} blocks</span>
                      </div>

                  {/* Blocks List — Smooth drag-and-drop reordering with zero entrance bounce */}
                  <Reorder.Group
                    axis="y"
                    values={currentPage.blocks}
                    onReorder={handleReorderBlocks}
                    className="space-y-1.5"
                    initial={false}
                  >
                    <AnimatePresence initial={false}>
                      {currentPage.blocks.map((block) => (
                        <NoteBlockItem
                          key={block.id}
                          block={block}
                          darkMode={darkMode}
                          themeColor={currentSection?.color || activePalette.primary}
                          userThemeColor={activePalette.primary}
                          isWorkspaceEntering={isWorkspaceEntering}
                          onUpdateContent={handleUpdateBlockContent}
                          onUpdateBlock={handleUpdateBlock}
                          onToggleTodo={handleToggleTodo}
                          onDelete={handleDeleteBlock}
                          onInsertBlockAfter={(afterId, type) => handleAddBlock(type, afterId)}
                          onContextMenu={handleBlockContextMenu}
                        />
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>
                </>
              ) : (
                <div className="text-center py-20 text-slate-500 text-sm">
                  Select or create a page on the left to begin drafting.
                </div>
              )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right-click Formatting Context Menu (Image 5) */}
      {blockContextMenu && (
        <div
          className={`fixed z-[130] w-60 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-2xl select-none text-xs animate-in fade-in zoom-in-95 duration-100 ${
            darkMode
              ? 'bg-slate-950/95 border-white/20 text-slate-200 shadow-black/80'
              : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/40'
          }`}
          style={{
            top: `${typeof window !== 'undefined' ? Math.max(8, Math.min(blockContextMenu.y, window.innerHeight - 340)) : blockContextMenu.y}px`,
            left: `${typeof window !== 'undefined' ? Math.max(8, Math.min(blockContextMenu.x, window.innerWidth - 252)) : blockContextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Block Formatting</span>
            <span className="font-semibold text-amber-400">Context</span>
          </div>

          {/* Inline Text Styles */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => handleFormatBold(blockContextMenu.block)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition font-bold"
            >
              <span>Bold Text</span>
              <span className="text-[10px] font-mono opacity-50">**bold**</span>
            </button>
            <button
              type="button"
              onClick={() => handleFormatItalic(blockContextMenu.block)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition italic"
            >
              <span>Italic Text</span>
              <span className="text-[10px] font-mono opacity-50">*italic*</span>
            </button>
            <button
              type="button"
              onClick={() => handleFormatCode(blockContextMenu.block)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition font-mono"
            >
              <span>Inline Code</span>
              <span className="text-[10px] font-mono opacity-50">`code`</span>
            </button>
          </div>

          <div className="h-px bg-white/10 my-1" />

          {/* Text Color Swatches */}
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
            <span>Text Color</span>
            {blockContextMenu.block.textColor && (
              <button
                type="button"
                onClick={() => {
                  handleUpdateBlock(blockContextMenu.block.id, { textColor: undefined });
                  setBlockContextMenu(null);
                }}
                className="text-[9px] text-amber-400 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            {[
              { label: 'Default', value: undefined, bg: 'bg-slate-400' },
              { label: 'Amber', value: '#fbbf24', bg: 'bg-amber-400' },
              { label: 'Emerald', value: '#34d399', bg: 'bg-emerald-400' },
              { label: 'Sky', value: '#38bdf8', bg: 'bg-sky-400' },
              { label: 'Rose', value: '#fb7185', bg: 'bg-rose-400' },
              { label: 'Violet', value: '#a78bfa', bg: 'bg-violet-400' },
              { label: 'Muted', value: '#94a3b8', bg: 'bg-slate-400' },
            ].map((swatch) => (
              <button
                key={swatch.label}
                type="button"
                title={swatch.label}
                onClick={() => {
                  handleUpdateBlock(blockContextMenu.block.id, { textColor: swatch.value });
                  setBlockContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full ${swatch.bg} border transition hover:scale-110 active:scale-95 cursor-pointer ${
                  blockContextMenu.block.textColor === swatch.value
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-950 scale-105'
                    : 'border-white/20'
                }`}
              />
            ))}
          </div>

          {/* Font Family Style Selection */}
          <div className="h-px bg-white/10 my-1" />
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Font Style
          </div>
          <div className="grid grid-cols-4 gap-1 px-2 py-0.5">
            {[
              { id: 'default', label: 'Sans', fontClass: 'font-sans' },
              { id: 'mono', label: 'Mono', fontClass: 'font-mono' },
              { id: 'serif', label: 'Serif', fontClass: 'font-serif' },
              { id: 'display', label: 'Display', fontClass: 'font-sans font-semibold tracking-tight' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  handleUpdateBlock(blockContextMenu.block.id, {
                    fontFamily: f.id as 'default' | 'mono' | 'serif' | 'display',
                  });
                  setBlockContextMenu(null);
                }}
                className={`px-1.5 py-1 rounded-md text-[11px] text-center border transition cursor-pointer ${f.fontClass} ${
                  (blockContextMenu.block.fontFamily || 'default') === f.id
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                    : darkMode
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="h-px bg-white/10 my-1" />

          {/* Bullets & Lists Formatting */}
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
            <span>Bullets</span>
            <span className="text-[10px] text-amber-400 font-mono">List Type</span>
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => handleConvertBlockType(blockContextMenu.block, 'bullet')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer ${
                blockContextMenu.block.type === 'bullet' ? 'text-amber-400 font-bold bg-amber-400/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Bullet List</span>
              </div>
              <span className="text-[10px] font-mono opacity-40">• item</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlockType(blockContextMenu.block, 'numbered')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer ${
                blockContextMenu.block.type === 'numbered' ? 'text-amber-400 font-bold bg-amber-400/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-amber-400">1.</span>
                <span>Numbered List</span>
              </div>
              <span className="text-[10px] font-mono opacity-40">1. 2. 3.</span>
            </button>
            <button
              type="button"
              onClick={() => handleConvertBlockType(blockContextMenu.block, 'todo')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer ${
                blockContextMenu.block.type === 'todo' ? 'text-amber-400 font-bold bg-amber-400/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>To-Do Checklist</span>
              </div>
              <span className="text-[10px] font-mono opacity-40">[ ] todo</span>
            </button>
            {blockContextMenu.block.type !== 'paragraph' && (
              <button
                type="button"
                onClick={() => handleConvertBlockType(blockContextMenu.block, 'paragraph')}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg hover:bg-white/10 text-left transition text-slate-400 hover:text-slate-200 text-[11px] cursor-pointer"
              >
                <span>Clear list format</span>
                <span className="text-[10px] font-mono opacity-50">Plain text</span>
              </button>
            )}
          </div>

          <div className="h-px bg-white/10 my-1" />

          {/* Indent Actions */}
          <div className="grid grid-cols-2 gap-1 px-1">
            <button
              type="button"
              onClick={() => handleChangeIndent(blockContextMenu.block, 1)}
              className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-center transition font-mono text-[11px]"
            >
              + Indent (Tab)
            </button>
            <button
              type="button"
              onClick={() => handleChangeIndent(blockContextMenu.block, -1)}
              className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-center transition font-mono text-[11px]"
            >
              - Outdent
            </button>
          </div>

          <div className="h-px bg-white/10 my-1" />

          {/* Delete Block */}
          <button
            type="button"
            onClick={() => {
              handleDeleteBlock(blockContextMenu.block.id);
              setBlockContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left transition font-semibold cursor-pointer"
          >
            <span>Delete Block</span>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Full-Viewport Modal: Confirm Delete Section */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Section?</h3>
                <p className="text-xs text-slate-400 font-mono">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete section <span className="font-semibold text-rose-300">&quot;{sectionToDelete.title}&quot;</span>? All pages and notes within this section will be removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Delete Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Viewport Modal: Confirm Delete Page */}
      {pageToDelete && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Page?</h3>
                <p className="text-xs text-slate-400 font-mono">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-rose-300">&quot;{pageToDelete.title}&quot;</span> and all its block content?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPageToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePage}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Viewport Modal: Confirm Delete Notebook */}
      {notebookToDelete && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Notebook?</h3>
                <p className="text-xs text-slate-400 font-mono">This action will delete all sections and pages in this notebook.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-rose-300">&quot;{notebookToDelete.title}&quot;</span>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setNotebookToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNotebook}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Delete Notebook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
