'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { ServiceFormState } from './actions';

const initialState: ServiceFormState = {};

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export type BusinessHours = Record<string, [string, string] | null>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="dash-btn" disabled={pending}>
      {pending ? 'Salvando...' : label}
    </button>
  );
}

export function ServiceForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ServiceFormState, formData: FormData) => Promise<ServiceFormState>;
  defaultValues?: {
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
    bookingMode: string;
    businessHours: BusinessHours | null;
    is24h: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [is24h, setIs24h] = useState(defaultValues?.is24h ?? false);

  const durationIsHours = !!defaultValues && defaultValues.durationMinutes % 60 === 0 && defaultValues.durationMinutes >= 60;
  const durationValue = defaultValues
    ? durationIsHours
      ? defaultValues.durationMinutes / 60
      : defaultValues.durationMinutes
    : undefined;
  const priceValue = defaultValues ? (defaultValues.priceCents / 100).toFixed(2) : undefined;
  const hasCustomHours = !!defaultValues?.businessHours;

  return (
    <form action={formAction}>
      {state?.error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>{state.error}</div>}
      <div className="dash-form-row">
        <label>Nome</label>
        <input name="name" required defaultValue={defaultValues?.name} placeholder="Corte de cabelo" />
      </div>
      <div className="dash-form-row">
        <label>Descrição (opcional)</label>
        <textarea name="description" rows={2} defaultValue={defaultValues?.description ?? ''} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="dash-form-row" style={{ flex: 1 }}>
          <label>Duração</label>
          <input name="durationValue" type="number" min={1} step="1" required defaultValue={durationValue} />
        </div>
        <div className="dash-form-row" style={{ width: 120 }}>
          <label>Unidade</label>
          <select name="durationUnit" defaultValue={durationIsHours ? 'hours' : 'minutes'}>
            <option value="minutes">minutos</option>
            <option value="hours">horas</option>
          </select>
        </div>
      </div>
      <div className="dash-form-row">
        <label>Preço (R$)</label>
        <input name="price" type="number" min={0} step="0.01" required defaultValue={priceValue} placeholder="50.00" />
      </div>

      <div className="dash-form-row">
        <label>Modo de agendamento</label>
        <select name="bookingMode" defaultValue={defaultValues?.bookingMode ?? 'auto'}>
          <option value="auto">Automático — o bot confirma direto com o cliente</option>
          <option value="manual">
            Pré-agendamento — o bot avisa que a equipe vai ligar pra confirmar
          </option>
        </select>
      </div>

      <div className="dash-form-row">
        <label>
          <input
            type="checkbox"
            name="is24h"
            checked={is24h}
            onChange={(e) => setIs24h(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Disponível 24h — qualquer dia da semana, a qualquer horário
        </label>
      </div>

      {!is24h && (
        <div className="dash-form-row">
          <label>
            <input type="checkbox" name="useCustomHours" defaultChecked={hasCustomHours} style={{ marginRight: 6 }} />
            Este serviço tem horário de funcionamento próprio (diferente do padrão da empresa)
          </label>
        </div>
      )}

      <div style={{ display: is24h ? 'none' : 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {DAYS.map(({ key, label }) => {
          const dayHours = defaultValues?.businessHours?.[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 80 }}>{label}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" name={`hours_${key}_closed`} defaultChecked={dayHours === null && !!defaultValues?.businessHours} />
                Fechado
              </label>
              <input
                type="time"
                name={`hours_${key}_open`}
                defaultValue={dayHours ? dayHours[0] : '09:00'}
                style={{ padding: '4px 6px' }}
              />
              <span>às</span>
              <input
                type="time"
                name={`hours_${key}_close`}
                defaultValue={dayHours ? dayHours[1] : '18:00'}
                style={{ padding: '4px 6px' }}
              />
            </div>
          );
        })}
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
