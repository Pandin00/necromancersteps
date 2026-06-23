# Game Design Document (GDD)

## 1. Informazioni Generali
*   **Titolo del Gioco:** I 100 Passi del Necromante
*   **Genere:** Roguelite / Auto-Battler / Social Game
*   **Piattaforma:** Reddit (tramite piattaforma Devvit)
*   **Motore Grafico:** Phaser 3 (Frontend) + Hono/tRPC (Backend)

---

## 2. Concept & Core Loop
Il gioco è un'esperienza asincrona e persistente che si svolge direttamente all'interno di un post su Reddit. Il giocatore interpreta un Necromante che dispone di "100 Passi" per esplorare una mappa procedurale.
La particolarità principale risiede nella **generazione dell'armata**: le truppe del giocatore non sono pre-fabbricate, ma vengono generate dinamicamente "leggendo" e analizzando i commenti che gli altri utenti di Reddit lasciano sotto al post stesso.

**Core Loop:**
1. Spendi Passi per muoverti sulla Mappa (esplorazione).
2. Genera l'armata analizzando i commenti della community.
3. Affronta l'Auto-Battler contro i nemici del nodo corrente.
4. Guadagna Anime (Souls) vincendo gli scontri.
5. Usa le Anime nello Shop per potenziare permanentemente l'armata.
6. Ripeti finché hai Passi a disposizione.

---

## 3. Meccaniche di Gioco

### 3.1. Risorse e Persistenza (Backend Redis)
*   **Passi (Steps):** L'energia vitale del Necromante. Ogni account parte con un massimale di 100 Passi. Spostarsi da un nodo all'altro consuma 1 Passo. Il dato è persistente sul database Redis e legato all'ID univoco dell'utente Reddit.
*   **Anime (Souls):** La valuta in-game. Si guadagnano sconfiggendo le unità nemiche e si spendono nello Shop per i potenziamenti permanenti. Salvate anch'esse su Redis.

### 3.2. Mappa e Navigazione (RogueLite)
La `MapScene` presenta un grafo di nodi connessi. Il giocatore seleziona fisicamente il nodo successivo cliccandolo per far avanzare il proprio avatar.
Esistono tre tipi di nodi:
*   🟢 **Start:** Nodo di partenza sicuro.
*   🔴 **Battle:** Innesca il combattimento e carica la `GameScene` (Auto-Battler).
*   🟡 **Treasure:** Evento speciale che premia istantaneamente il giocatore (+20 Anime) senza dover combattere.

### 3.3. Scraping dei Commenti e Tipi di Unità
Prima di una battaglia, il server tRPC si collega alle API native di Reddit (`reddit.getComments`) per scaricare i commenti più recenti del thread. Il testo viene analizzato tramite regole per stabilire la "razza" dell'unità da aggiungere all'armata:
*   **SKELETON (Scheletro Base - Blu):** L'unità standard. Generata da qualsiasi commento corto o sprovvisto di parole chiave. (10 HP base, 2 ATK base).
*   **GOLEM (Tank - Verde):** Un'unità resistente. Viene evocata se un utente ha scritto un commento prolisso, superando le **40 parole**. (30 HP base, 5 ATK base).
*   **MAGE (Mago - Viola):** Un'unità magica. Viene evocata se il testo del commento contiene parole chiave come `"fuoco"`, `"magia"` o `"maledizione"`. (8 HP base, 6 ATK base).

*Fallback System:* Se il post non ha ancora commenti, il backend genera truppe fittizie di "sistema" per permettere al giocatore di non bloccarsi mai.

### 3.4. Auto-Battler Engine
Il combattimento si svolge nella scena `Game.ts` in modo del tutto autonomo ("Zero-Player Game").
*   Le armate (Player vs Enemy) si schierano orizzontalmente come code impilate.
*   Alla pressione di "AVVIA BATTAGLIA", la prima unità della coda del giocatore carica in avanti (animazione Tween) e colpisce il nemico frontale, per poi tornare indietro e subire il contrattacco.
*   Quando una truppa muore (HP <= 0), svanisce e l'intera coda dietro di lei "scivola in avanti" per coprire il gap.
*   La battaglia termina quando un'armata viene interamente decimata.

### 3.5. Shop e Progressione
Situato direttamente nella UI della mappa, lo Shop permette di convertire le Anime accumulate per comprare potenziamenti globali.
*   **Costo fisso:** 10 Anime per upgrade.
*   **Opzioni:** "Upgrade HP" (fornisce +5 HP base a tutte le truppe evocate) o "Upgrade ATK" (+1 Attacco base a tutte le truppe evocate).
*   Gli upgrade scalano all'infinito e si applicano dinamicamente a tutti i commenti pescati dal server nei combattimenti successivi.

---

## 4. Stack Tecnologico
*   **Client (Frontend):** TypeScript, Phaser 3 (Canvas 2D Rendering), Vite. L'app client gira all'interno di un iFrame controllato da Devvit Web.
*   **Server (Backend):** Devvit serverless runtime (Node.js), `@devvit/web/server`, Redis API integrate.
*   **Comunicazione:** tRPC v11. Questo strato garantisce un'integrazione di tipo *end-to-end type safe*, assicurando che frontend e backend condividano gli stessi tipi, riducendo drasticamente i bug e offrendo solidità in fase di build.
