import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ChordDiagramPopup from "./ChordDiagram";
import ChartViewer from "./ChartViewer";

const GUITAR_CHORDS_CATALOG = [
  { name: 'G', type: 'Major' }, { name: 'C', type: 'Major' }, { name: 'D', type: 'Major' },
  { name: 'E', type: 'Major' }, { name: 'A', type: 'Major' }, { name: 'F', type: 'Major' },
  { name: 'Em', type: 'Minor' }, { name: 'Am', type: 'Minor' }, { name: 'Dm', type: 'Minor' },
  { name: 'Bm', type: 'Minor' }, { name: 'F#m', type: 'Minor' }, { name: 'C#m', type: 'Minor' },
  { name: 'G7', type: '7th' }, { name: 'D7', type: '7th' }, { name: 'E7', type: '7th' }, { name: 'A7', type: '7th' },
  { name: 'Gsus4', type: 'Sus' }, { name: 'Dsus4', type: 'Sus' }, { name: 'Asus2', type: 'Sus' },
  { name: 'Cmaj7', type: '7th' }, { name: 'Gmaj7', type: '7th' },
  { name: 'Cadd9', type: 'Add' }, { name: 'Dadd9', type: 'Add' },
];

const CHORD_TYPES = ['All', 'Major', 'Minor', '7th', 'Sus'];

const GUITAR_CHORDS_DATA = {
  'G': [[3,0],[1,0],[2,0]],
  'C': [[2,1],[1,2],[2,2]],
  'D': [[1,3],[3,2],[2,3]],
  'E': [[2,2],[3,2],[2,1]],
  'A': [[2,2],[2,3],[2,4]],
  'F': [[1,1],[2,1],[3,2],[3,3]],
  'Em': [[2,5],[3,5]],
  'Am': [[2,4],[1,3],[2,3]],
  'Dm': [[1,5],[3,4],[2,3]],
  'Bm': [[2,2],[3,3],[4,4],[4,5]],
  'F#m': [[2,2],[3,3],[4,4],[4,5]],
  'C#m': [[1,4],[2,5],[3,6],[4,6]],
};

function MiniGuitarDiagram({ chord }) {
  const strings = 6;
  const frets = 4;
  const cW = 11, cH = 9, padL = 8, padT = 12;
  const W = cW * (strings - 1) + padL * 2;
  const H = cH * frets + padT + 8;

  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
      <rect x={padL} y={padT} width={cW * (strings - 1)} height={2} fill="#555" rx={1} />
      {Array.from({ length: frets + 1 }).map((_, i) => (
        <line key={i} x1={padL} y1={padT + 2 + i * cH} x2={padL + cW * (strings - 1)} y2={padT + 2 + i * cH} stroke="#333" strokeWidth={0.5} />
      ))}
      {Array.from({ length: strings }).map((_, i) => (
        <line key={i} x1={padL + i * cW} y1={padT + 2} x2={padL + i * cW} y2={padT + 2 + frets * cH} stroke="#444" strokeWidth={0.5} />
      ))}
      {(GUITAR_CHORDS_DATA[chord] || []).map(([str, fret], i) => (
        <circle key={i} cx={padL + (str - 1) * cW} cy={padT + 2 + (fret - 1) * cH + cH / 2} r={3.5} fill="hsl(var(--primary))" />
      ))}
    </svg>
  );
}

export default function ChartBuilderModal({ song, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('chords');
  const [chartContent, setChartContent] = useState(song?.chart_content || '');
  const [activeChord, setActiveChord] = useState(null);
  const [chordTypeFilter, setChordTypeFilter] = useState('All');

  const filteredChords = GUITAR_CHORDS_CATALOG.filter(c =>
    chordTypeFilter === 'All' || c.type === chordTypeFilter
  );

  const handleSave = () => onSave?.(chartContent);

  const TABS = [
    { id: 'edit', label: '✏ Edit' },
    { id: 'preview', label: '👁 Preview' },
    { id: 'chords', label: '🎸 Chords' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
          className="relative bg-[#18182a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
            <div>
              <p className="text-base font-bold text-foreground">Chart Builder — {song?.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{song?.artist} · Key: {song?.key} · {song?.bpm} BPM</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => window.print()}
                className="text-muted-foreground h-8 gap-1.5 text-xs border border-white/10">
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <Button size="sm" onClick={handleSave}
                className="bg-primary text-primary-foreground h-8 gap-1.5 text-xs font-semibold px-4">
                <Save className="w-3.5 h-3.5" /> Save
              </Button>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-secondary/60 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-secondary/30 rounded-xl mx-5 mb-4 p-1 shrink-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-[#18182a] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {activeTab === 'edit' && (
              <Textarea
                value={chartContent}
                onChange={e => setChartContent(e.target.value)}
                className="w-full min-h-[380px] bg-background/60 border-white/10 text-sm font-mono leading-relaxed resize-none"
                placeholder={"[Verse 1]\nC#m                    A\n  There is One on the throne\n  E     G#m\nJesus, holy"}
                style={{ whiteSpace: 'pre', overflowWrap: 'normal' }}
              />
            )}

            {activeTab === 'preview' && (
              <ChartViewer song={{ ...song, chart_content: chartContent }} />
            )}

            {activeTab === 'chords' && (
              <div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {CHORD_TYPES.map(t => (
                    <button key={t} onClick={() => setChordTypeFilter(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${chordTypeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'border-white/10 text-muted-foreground hover:text-foreground hover:border-white/30'}`}>
                      {t}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                  {filteredChords.map(chord => (
                    <button
                      key={chord.name}
                      onClick={() => setActiveChord(chord.name)}
                      className="bg-secondary/20 border border-white/10 hover:border-primary/40 hover:bg-secondary/40 rounded-xl p-3 text-center transition-all group"
                    >
                      <MiniGuitarDiagram chord={chord.name} />
                      <p className="text-sm font-bold text-foreground mt-2 font-mono group-hover:text-primary transition-colors">
                        {chord.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </motion.div>
      </div>

      {activeChord && (
        <ChordDiagramPopup chord={activeChord} onClose={() => setActiveChord(null)} />
      )}
    </AnimatePresence>
  );
}