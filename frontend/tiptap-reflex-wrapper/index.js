import React, { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Node } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';

// Light chunk node: block-level container with attributes id/kind and rich text content.
const Chunk = Node.create({
  name: 'chunk',
  group: 'block',
  content: 'block+',
  selectable: true,
  atom: false,
  addAttributes() {
    return {
      id: { default: null },
      kind: { default: 'user' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-chunk-id]',
        getAttrs: el => ({ id: el.getAttribute('data-chunk-id'), kind: el.getAttribute('data-chunk-kind') || 'user' }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    // Mirror attributes onto data-* for styling without polluting DOM with unknown props
    attrs['data-chunk-id'] = HTMLAttributes.id || null;
    attrs['data-chunk-kind'] = HTMLAttributes.kind || 'user';
    // Clean raw attributes that shouldn't be on DOM directly
    delete attrs.id;
    delete attrs.kind;
    attrs['class'] = ((attrs['class'] || '') + ' chunk-node').trim();
    return ['div', attrs, 0];
  },
});

function textToParagraphs(text) {
  const paras = String(text || '').split(/\n\n/g);
  return paras.map(p => {
    const lines = String(p).split('\n');
    const content = [];
    lines.forEach((line, idx) => {
      if (line) content.push({ type: 'text', text: line });
      if (idx < lines.length - 1) content.push({ type: 'hardBreak' });
    });
    return { type: 'paragraph', content };
  });
}

function buildDocFromChunks(chunks) {
  const content = (chunks || []).map(ch => ({
    type: 'chunk',
    attrs: { id: ch.id, kind: ch.kind || 'user' },
    content: textToParagraphs(ch.content || ''),
  }));
  return { type: 'doc', content };
}

function extractChunksFromEditor(editor) {
  const json = editor.getJSON();
  const out = [];
  const list = (json && Array.isArray(json.content)) ? json.content : [];
  for (const node of list) {
    if (node.type === 'chunk') {
      const id = node.attrs?.id || '';
      const kind = node.attrs?.kind || 'user';
      // Collect plain text from child nodes
      const container = editor.schema.nodeFromJSON(node);
      const view = editor.view;
      // Use DOMSerializer via a temporary editor instance? Simpler: use textContent from JSON
      // We'll reconstruct text by joining paragraphs with double newline
      const paras = (node.content || []).map(n => {
        if (n.type === 'paragraph') {
          const pieces = (n.content || []).filter(c => c.type === 'text').map(c => c.text || '');
          return pieces.join('');
        }
        return '';
      });
      const content = paras.join('\n\n');
      out.push({ id, kind, content });
    }
  }
  return out;
}

export function TipTapEditor(props) {
  const {
    value = '',
    placeholder = '',
    min_height = '140px',
    disabled = false,
    on_change,
    on_blur,
    style = {},
  } = props || {};

  // Normalize chunks list very defensively (Reflex may provide proxies)
  let chunkList = null;
  if (props && props.chunks) {
    if (Array.isArray(props.chunks)) {
      chunkList = props.chunks;
    } else if (typeof props.chunks.length === 'number') {
      const len = props.chunks.length >>> 0;
      const tmp = [];
      for (let i = 0; i < len; i++) {
        tmp.push(props.chunks[i] ?? props.chunks[String(i)] ?? null);
      }
      chunkList = tmp.filter(Boolean);
    } else {
      const keys = Object.keys(props.chunks || {}).filter(k => String(+k) === k);
      if (keys.length) {
        keys.sort((a,b) => (+a) - (+b));
        chunkList = keys.map(k => props.chunks[k]).filter(Boolean);
      }
    }
  }
  try { console.debug('[TipTap] chunks prop normalized length=', chunkList ? chunkList.length : 0); } catch {}

  const suppressInitial = useRef(true);
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Chunk,
        Placeholder.configure({ placeholder: placeholder || '' }),
      ],
      content: (chunkList) ? buildDocFromChunks(chunkList) : (value || ''),
      editable: !disabled,
      on_ops: props.on_ops,
      onUpdate({ editor }) {
        try {
          // Suppress setContent-triggered updates and the very first init update.
          if (editor._suppressNextUpdate) {
            editor._suppressNextUpdate = false;
            return;
          }
          if (suppressInitial.current) {
            suppressInitial.current = false;
            return;
          }
          if (typeof on_change === 'function') {
            if (props.chunks && Array.isArray(props.chunks)) {
              const chunks = extractChunksFromEditor(editor);
              on_change(chunks);
            } else {
              const text = editor.getText();
              on_change(text);
            }
          }
          // Debounced save trigger
          if (typeof on_blur === 'function') {
            if (!editor._saveTimer) {
              editor._saveTimer = null;
            }
            if (editor._saveTimer) clearTimeout(editor._saveTimer);
            editor._saveTimer = setTimeout(() => {
              try { on_blur(); } catch {}
            }, 900);
          }
        } catch {}
      },
      onBlur() {
        try {
          if (typeof on_blur === 'function') {
            on_blur();
          }
        } catch {}
      },
    },
    [disabled, placeholder]
  );

  // Keyboard shortcuts for split/merge.
  useEffect(() => {
    if (!editor) return;
    const view = editor.view;
    function getChunkInfo() {
      const { state } = editor;
      const { selection } = state;
      const $from = selection.$from;
      // Find ancestor chunk node
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type && node.type.name === 'chunk') {
          const posStart = $from.before(d);
          const posEnd = posStart + node.nodeSize;
          const id = node.attrs?.id || '';
          return { id, posStart, posEnd };
        }
      }
      return null;
    }
    function atChunkStart(info) {
      const { state } = editor;
      if (!state.selection.empty) return false;
      const cur = state.selection.from;
      // Start of chunk content is posStart + 1
      return cur === (info.posStart + 1);
    }

    function handleBackspace(e) {
      try {
        if (!editor.options.on_ops) return false;
        const info = getChunkInfo();
        if (!info) return false;
        if (atChunkStart(info)) {
          // Request merge with previous chunk
          editor.options.on_ops([{ type: 'merge_prev', id: info.id }]);
          e.preventDefault();
          return true;
        }
      } catch {}
      return false;
    }

    function handleModEnter(e) {
      try {
        if (!editor.options.on_ops) return false;
        const info = getChunkInfo();
        if (!info) return false;
        const { state } = editor;
        if (!state.selection.empty) return false;
        const from = state.selection.from;
        // Extract plain text before/after cursor within the chunk
        const before = state.doc.textBetween(info.posStart + 1, from, '\n\n', '\n');
        const after = state.doc.textBetween(from, info.posEnd - 1, '\n\n', '\n');
        if ((after || '').trim().length === 0) return false;
        editor.options.on_ops([{ type: 'split', id: info.id, before, after }]);
        e.preventDefault();
        return true;
      } catch {}
      return false;
    }

    function onKeyDown(e) {
      if (e.key === 'Backspace' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        if (handleBackspace(e)) return;
      }
      // Mod-Enter (Command on macOS, Control on Windows/Linux)
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (handleModEnter(e)) return;
      }
    }
    view.dom.addEventListener('keydown', onKeyDown, true);
    return () => view.dom.removeEventListener('keydown', onKeyDown, true);
  }, [editor]);

  // Value-mode submit: Mod+Enter commits composer
  useEffect(() => {
    if (!editor) return;
    if (chunkList) return; // only for value mode (composer)
    const view = editor.view;
    function onKeyDown(e) {
      const isEnter = (e.key === 'Enter' || e.key === 'Return' || e.code === 'Enter' || e.code === 'NumpadEnter');
      if (isEnter && (e.metaKey || e.ctrlKey)) {
        try {
          if (typeof props.on_submit === 'function') {
            e.preventDefault();
            const text = editor.getText();
            props.on_submit(text);
            return;
          }
        } catch {}
      }
    }
    view.dom.addEventListener('keydown', onKeyDown, true);
    return () => view.dom.removeEventListener('keydown', onKeyDown, true);
  }, [editor, chunkList, props.on_submit]);

  // Keep editor content in sync when 'value' or 'chunks' prop changes.
  useEffect(() => {
    if (!editor) return;
    try {
      if (chunkList) {
        const current = extractChunksFromEditor(editor);
        const next = chunkList || [];
        const same = (current.length === next.length) && current.every((c, i) => c.id === next[i].id && c.kind === next[i].kind && c.content === next[i].content);
        if (!same) {
          try { console.debug('[TipTap] setContent from chunks, count=', next.length); } catch {}
          editor._suppressNextUpdate = true;
          editor.commands.setContent(buildDocFromChunks(next));
        }
      } else {
        const current = editor.getText();
        const next = value || '';
        if (current !== next) {
          try { console.debug('[TipTap] setContent from value, length=', (next || '').length); } catch {}
          editor._suppressNextUpdate = true;
          editor.commands.setContent(next);
        }
      }
    } catch {}
  }, [editor, value, chunkList, props.version]);

  const mergedStyle = {
    minHeight: min_height || '140px',
    width: '100%',
    ...style,
  };

  return React.createElement(
    'div',
    { style: mergedStyle, className: 'tiptap-editor' },
    editor ? React.createElement(EditorContent, { editor }) : null
  );
}
