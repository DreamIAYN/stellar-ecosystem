import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { bracketMatching, defaultHighlightStyle, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, dropCursor, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, rectangularSelection } from '@codemirror/view'
import { useEffect, useRef } from 'react'

const theme = EditorView.theme(
  {
    '&': { color: '#c8d6ee', backgroundColor: 'transparent', height: '100%', fontSize: '12px' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.72', overflow: 'auto' },
    '.cm-gutters': { backgroundColor: '#070b12', color: '#43506a', border: 'none', paddingLeft: '4px' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.028)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.03)', color: '#8294b5' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(105,230,255,.18) !important' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#69e6ff' },
    '.cm-content': { padding: '12px 0', caretColor: '#69e6ff' },
    '.cm-line': { padding: '0 16px' },
    '.cm-foldPlaceholder': { backgroundColor: 'rgba(255,255,255,.08)', border: '0', color: '#91a2c0' },
    '.cm-panels': { backgroundColor: '#0b111c', color: '#c8d6ee', borderColor: '#1c2638' },
    '.cm-panels input': { background: '#070b12', border: '1px solid #263247', color: '#e6eefc', padding: '3px 6px', borderRadius: '5px' },
    '.cm-searchMatch': { backgroundColor: 'rgba(249,200,106,.22)', outline: '1px solid rgba(249,200,106,.5)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(249,200,106,.45)' },
    '.cm-tooltip': { background: '#111827', border: '1px solid #263247' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(105,230,255,.16)', outline: '1px solid rgba(105,230,255,.3)' },
  },
  { dark: true },
)

function languageFor(name: string): Extension[] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ts' || ext === 'tsx') return [javascript({ typescript: true, jsx: ext === 'tsx' })]
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs') return [javascript({ jsx: ext === 'jsx' })]
  if (ext === 'html' || ext === 'htm') return [html()]
  if (ext === 'css') return [css()]
  if (ext === 'json') return [json()]
  if (ext === 'py') return [python()]
  if (ext === 'md' || ext === 'markdown') return [markdown()]
  return []
}

export function CodeEditor({ value, filename, onChange, onStats }: { value: string; filename: string; onChange: (v: string) => void; onStats?: (line: number, col: number) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const language = useRef(new Compartment())
  const suppress = useRef(false)
  const changeRef = useRef(onChange)
  const statsRef = useRef(onStats)
  changeRef.current = onChange
  statsRef.current = onStats

  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.tabSize.of(2),
        indentOnInput(),
        bracketMatching(),
        search({ top: true }),
        rectangularSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        language.current.of(languageFor(filename)),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppress.current) changeRef.current(update.state.doc.toString())
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            statsRef.current?.(line.number, head - line.from + 1)
          }
        }),
      ],
    })
    const v = new EditorView({ state, parent: host.current })
    view.current = v
    const line = state.doc.lineAt(state.selection.main.head)
    statsRef.current?.(line.number, 1)
    return () => { v.destroy(); view.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename])

  useEffect(() => {
    const v = view.current
    if (!v) return
    if (v.state.doc.toString() !== value) {
      suppress.current = true
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
      suppress.current = false
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: language.current.reconfigure(languageFor(filename)) })
  }, [filename])

  return <div className="code-editor" ref={host} />
}
