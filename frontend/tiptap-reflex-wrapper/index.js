import React, { useEffect } from 'react';
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
  const parts = String(text || '').split(/\n\n/g);
  return parts.map(p => ({ type: 'paragraph', content: p ? [{ type: 'text', text: p }] : [] }));
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

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Chunk,
        Placeholder.configure({ placeholder: placeholder || '' }),
      ],
      content: (props.chunks && Array.isArray(props.chunks)) ? buildDocFromChunks(props.chunks) : (value || ''),
      editable: !disabled,
      onUpdate({ editor }) {
        try {
          if (typeof on_change === 'function') {
            if (props.chunks && Array.isArray(props.chunks)) {
              const chunks = extractChunksFromEditor(editor);
              on_change(chunks);
            } else {
              const text = editor.getText();
              on_change(text);
            }
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

  // Keep editor content in sync when 'value' or 'chunks' prop changes.
  useEffect(() => {
    if (!editor) return;
    try {
      if (props.chunks && Array.isArray(props.chunks)) {
        const current = extractChunksFromEditor(editor);
        const next = Array.isArray(props.chunks) ? props.chunks : [];
        const same = (current.length === next.length) && current.every((c, i) => c.id === next[i].id && c.kind === next[i].kind && c.content === next[i].content);
        if (!same) {
          editor.commands.setContent(buildDocFromChunks(next));
        }
      } else {
        const current = editor.getText();
        const next = value || '';
        if (current !== next) {
          editor.commands.setContent(next);
        }
      }
    } catch {}
  }, [editor, value, props.chunks, props.version]);

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
