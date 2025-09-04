import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

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
        Placeholder.configure({ placeholder: placeholder || '' }),
      ],
      content: value || '',
      editable: !disabled,
      onUpdate({ editor }) {
        try {
          const text = editor.getText();
          if (typeof on_change === 'function') {
            on_change(text);
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

  // Keep editor content in sync when 'value' prop changes.
  useEffect(() => {
    if (!editor) return;
    try {
      const current = editor.getText();
      const next = value || '';
      if (current !== next) {
        editor.commands.setContent(next);
      }
    } catch {}
  }, [editor, value]);

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

