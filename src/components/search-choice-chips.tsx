import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addChoice } from "@/lib/api-search-batch";

export function SearchChoiceChips({ label, suggestions, selected, onChange, disabled, placeholder }: {
  label: string; suggestions: string[]; selected: string[]; onChange: (values: string[]) => void; disabled: boolean; placeholder: string;
}) {
  const [custom, setCustom] = useState("");
  const choices = [...suggestions, ...selected.filter(value => !suggestions.includes(value))];
  function add() { onChange(addChoice(selected, custom)); setCustom(""); }
  return <fieldset className="min-w-0 space-y-3" disabled={disabled}>
    <legend className="mb-3 text-sm font-medium">{label} *</legend>
    <div className="flex flex-wrap gap-2">{choices.map(value => <Button key={value} type="button" size="sm" variant={selected.includes(value) ? "default" : "outline"} aria-pressed={selected.includes(value)} disabled={disabled} className="h-auto max-w-full whitespace-normal break-words rounded-full px-3 py-1.5 text-xs" onClick={() => onChange(selected.includes(value) ? selected.filter(item => item !== value) : addChoice(selected, value))}>{selected.includes(value) && <Check className="size-3 shrink-0" />}{value}</Button>)}</div>
    <div className="flex gap-2"><Label htmlFor={`custom-${label}`} className="sr-only">{placeholder}</Label><Input id={`custom-${label}`} placeholder={placeholder} maxLength={60} disabled={disabled} value={custom} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!disabled) add(); } }} /><Button type="button" variant="outline" size="icon" aria-label={`Adicionar ${label.toLowerCase()}`} title={`Adicionar ${label.toLowerCase()}`} disabled={disabled || !custom.trim()} onClick={add}><Plus /></Button></div>
  </fieldset>;
}