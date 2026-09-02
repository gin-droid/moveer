export default function TermsContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      <p className="text-foreground font-medium">
        Installando o utilizzando l'app moVeerAI accetti integralmente i presenti termini e condizioni d'uso.
        Se non sei d'accordo, non installare né utilizzare l'applicazione.
      </p>

      <Section title="1. Descrizione del servizio">
        moVeerAI è un'applicazione di analisi biomeccanica del movimento che utilizza l'intelligenza artificiale
        per valutare la postura e la tecnica di esecuzione degli esercizi fisici a partire da video o immagini
        forniti dall'utente. Il servizio include la generazione di report di analisi, raccomandazioni di
        correzione ed esercizi correttivi. Le analisi hanno scopo informativo e didattico e non sostituiscono
        il parere di un professionista sanitario o di un istruttore qualificato.
      </Section>

      <Section title="2. Accettazione dei termini">
        Con l'installazione dell'applicazione su un dispositivo o con l'accesso al servizio tramite browser,
        l'utente accetta di essere vincolato dai presenti termini d'uso e dalla relativa informativa sulla
        privacy. L'utilizzo continuato dell'app dopo eventuali modifiche dei termini costituisce
        accettazione delle stesse.
      </Section>

      <Section title="3. Requisiti e responsabilità dell'utente">
        L'utente dichiara di avere l'età legale per prestare il consenso e di disporre della capacità giuridica
        necessaria. L'utente è responsabile dell'accuratezza dei dati e dei video forniti e dell'utilizzo
        dell'app in conformità con le leggi applicabili. È vietato utilizzare il servizio per scopi illeciti
        o per danneggiare terzi.
      </Section>

      <Section title="4. Dati personali e contenuti">
        I dati personali e i contenuti (video, immagini, report) forniti dall'utente sono trattati secondo
        l'informativa sulla privacy. L'utente conserva la titolarità dei propri contenuti e concede a moVeerAI
        una licenza limitata, non esclusiva e revocabile per l'elaborazione necessaria alla fornitura del
        servizio.
      </Section>

      <Section title="5. Limitazione della responsabilità">
        moVeerAI e i suoi sviluppatori non rispondono di eventuali infortuni, lesioni o danni derivanti
        dall'esecuzione degli esercizi basata sulle analisi fornite. Le raccomandazioni dell'app non costituiscono
        consulenza medica, fisioterapica o sanitaria. L'utente si allena a proprio rischio e dovrebbe consultare
        un professionista prima di intraprendere qualsiasi programma di allenamento.
      </Section>

      <Section title="6. Proprietà intellettuale">
        L'applicazione, il marchio moVeerAI, i contenuti e il codice sono protetti dal diritto d'autore e dalla
        normativa sulla proprietà intellettuale. È vietata la riproduzione, la modifica o la distribuzione non
        autorizzata dell'app o di sue parti.
      </Section>

      <Section title="7. Modifiche e disponibilità del servizio">
        moVeerAI si riserva il diritto di modificare, sospendere o interrompere il servizio in qualsiasi momento,
        con o senza preavviso. I presenti termini possono essere aggiornati periodicamente; le modifiche
        entrano in vigore dalla pubblicazione.
      </Section>

      <Section title="8. Contatti">
        Per qualsiasi domanda sui termini d'uso è possibile contattare il team tramite la pagina Contatti
        dell'app.
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
      <p>{children}</p>
    </div>
  );
}