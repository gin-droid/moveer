export default function PrivacyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <p className="text-foreground font-medium">
        La presente informativa sulla privacy descrive come moVeerAI raccoglie, utilizza e protegge i dati
        personali degli utenti in conformità al Regolamento (UE) 2016/679 (GDPR).
      </p>

      <Section title="1. Titolare del trattamento">
        Il titolare del trattamento dei dati è moVeerAI. Per qualsiasi richiesta relativa ai propri dati
        personali, l'utente può contattare il titolare tramite la pagina Contatti dell'app.
      </Section>

      <Section title="2. Tipologie di dati raccolti">
        <p className="mb-2">moVeerAI tratta le seguenti categorie di dati:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="text-foreground">Dati dell'account:</span> nome, email e ruolo, necessari per la registrazione e l'accesso.</li>
          <li><span className="text-foreground">Contenuti multimediali:</span> video e immagini caricati dall'utente per l'analisi biomeccanica della postura e della tecnica di esecuzione.</li>
          <li><span className="text-foreground">Dati biometrici e biomeccanici:</span> risultati delle analisi (punteggi, problemi rilevati, correzioni, diagrammi posturali) generati dall'IA a partire dai contenuti forniti.</li>
          <li><span className="text-foreground">Dati wearable (facoltativi):</span> frequenza cardiaca, accelerazione, rotazione e cadenza rilevati da dispositivi esterni collegati via Bluetooth (fascia cardio, smartwatch).</li>
          <li><span className="text-foreground">Dati di profondità (facoltativi):</span> misurazioni 3D delle giunzioni articolari acquisite tramite sensori LiDAR/ToF del dispositivo.</li>
          <li><span className="text-foreground">Dati di utilizzo:</span> informazioni aggregate e anonime per finalità statistiche e di miglioramento del servizio.</li>
        </ul>
      </Section>

      <Section title="3. Finalità e base giuridica del trattamento">
        I dati sono trattati per le seguenti finalità:
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Esecuzione dell'analisi biomeccanica e generazione dei report (base: esecuzione di un contratto / consenso).</li>
          <li>Gestione dell'account e autenticazione (base: esecuzione di un contratto).</li>
          <li>Conservazione dello storico delle analisi e confronto dei progressi nel tempo (base: consenso).</li>
          <li>Miglioramento del servizio e delle funzionalità dell'IA (base: legittimo interesse, con dati anonimizzati).</li>
        </ul>
      </Section>

      <Section title="4. Conservazione dei dati">
        I contenuti multimediali (video e immagini) caricati per l'analisi sono conservati per il tempo
        necessario all'elaborazione e alla generazione del report. I report e i dati aggregati sono conservati
        fino a quando l'utente non richiede la cancellazione del proprio account o l'eliminazione dei singoli
        report. L'utente può eliminare in qualsiasi momento i propri report o l'intero account dalle
        impostazioni dell'app.
      </Section>

      <Section title="5. Condivisione e comunicazione dei dati">
        I dati personali non sono venduti né ceduti a terzi. I contenuti multimediali e i dati aggregati sono
        inviati a fornitori di servizi di intelligenza artificiale esclusivamente per l'elaborazione delle
        analisi, secondo contratti e garanzie di riservatezza. Nessun dato identificativo viene utilizzato
        per finalità di marketing senza il consenso esplicito dell'utente.
      </Section>

      <Section title="6. Diritti dell'utente">
        L'utente ha diritto di:
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Accedere ai propri dati personali e ottenere una copia.</li>
          <li>Chiedere la rettifica di dati inesatti o incompleti.</li>
          <li>Richiedere la cancellazione dei propri dati o dell'intero account.</li>
          <li>Limitare o opporsi al trattamento dei propri dati.</li>
          <li>Ricevere i propri dati in formato strutturato (portabilità).</li>
          <li>Revocare il consenso prestato in qualsiasi momento.</li>
        </ul>
        Per esercitare questi diritti, l'utente può utilizzare le funzioni dell'app o contattare il titolare
        tramite la pagina Contatti.
      </Section>

      <Section title="7. Sicurezza dei dati">
        moVeerAI adotta misure tecniche e organizzative adeguate per proteggere i dati personali da accessi
        non autorizzati, perdita o alterazione, inclusa la crittografia delle comunicazioni e la limitazione
        degli accessi ai soli sistemi necessari all'erogazione del servizio.
      </Section>

      <Section title="8. Cookie e tecnologie simili">
        L'app utilizza esclusivamente tecnologie di archiviazione locale necessarie al funzionamento
        (autenticazione, preferenze dell'utente) e non impiega cookie di profilazione o tracciamento
        pubblicitario di terze parti.
      </Section>

      <Section title="9. Trasferimento dei dati al di fuori dell'UE">
        Qualora i dati siano trattati da fornitori con sede al di fuori dell'Unione Europea, il trasferimento
        avviene nel rispetto delle garanzie previste dal GDPR (clausole contrattuali tipo o decisioni di
        adeguatezza) e limitatamente alle finalità descritte nella presente informativa.
      </Section>

      <Section title="10. Minori">
        Il servizio non è rivolto a minori di 16 anni. moVeerAI non raccoglie consapevolmente dati personali
        di minori senza il consenso dei genitori o di chi esercita la responsabilità genitoriale.
      </Section>

      <Section title="11. Modifiche all'informativa">
        La presente informativa può essere aggiornata periodicamente per riflettere cambiamenti normativi
        o nelle modalità del servizio. Le modifiche entrano in vigore dalla pubblicazione nell'app.
      </Section>

      <p className="text-xs text-muted-foreground pt-3 border-t border-border">
        Ultimo aggiornamento: settembre 2026
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-foreground font-medium mb-1.5">{title}</h3>
      <div>{children}</div>
    </div>
  );
}