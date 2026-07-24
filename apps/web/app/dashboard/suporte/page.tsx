import { SupportForm } from './support-form';

export default function SuportePage() {
  return (
    <>
      <h1 className="dash-h1">Suporte</h1>
      <p className="dash-subtitle">
        Encontrou um bug, tem uma dúvida ou uma sugestão? Manda pra gente aqui.
      </p>

      <div className="dash-card">
        <SupportForm />
      </div>
    </>
  );
}
