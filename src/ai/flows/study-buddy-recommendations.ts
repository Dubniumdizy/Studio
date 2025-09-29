'use server';

/**
 * @fileOverview Provides study recommendations and advice through an AI-driven 'study buddy'.
 *
 * - getStudyBuddyRecommendations - A function that generates tailored study recommendations.
 * - StudyBuddyInput - The input type for the getStudyBuddyRecommendations function.
 * - StudyBuddyOutput - The return type for the getStudyBuddyRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudyBuddyInputSchema = z.object({
  studyTopic: z.string().describe('The specific subject or topic the student is studying.'),
  studyGoals: z
    .string()
    .describe(
      "The student's specific goals for studying this topic (e.g., pass an exam, complete a project)."
    ),
  currentIssue: z.string().optional().describe("The user's current primary challenge or struggle (e.g., motivation, burnout, ADHD), or a direct question."),
  examDate: z.string().optional().describe('The date of the upcoming exam, if applicable (ISO format).'),
});
export type StudyBuddyInput = z.infer<typeof StudyBuddyInputSchema>;

const StudyBuddyOutputSchema = z.object({
  studyTechniques: z
    .string()
    .describe("Tailored study techniques that align with the student's goals and challenges, formatted with bullet points. If the user is asking a direct question, provide a brief, generic sentence here like 'Here is the answer to your question.'"),
  timeManagementStrategies: z
    .string()
    .describe("Strategies for effectively managing study time, formatted with bullet points. If the user is asking a direct question, this field can be a generic placeholder like 'No specific time management advice requested.'"),
  additionalAdvice: z
    .string()
    .describe("If the user is seeking study advice, this section must be structured with **Physical**, **Intellectual**, and **Emotional** subheadings, each with bullet points, drawing from the knowledge base. If the user is asking a direct, general question (e.g., 'what is 5+6?'), this field should contain a direct, helpful answer to that question, and the P/I/E structure should be ignored."),
});
export type StudyBuddyOutput = z.infer<typeof StudyBuddyOutputSchema>;

export async function getStudyBuddyRecommendations(input: StudyBuddyInput): Promise<StudyBuddyOutput> {
  return studyBuddyRecommendationsFlow(input);
}

const studyBuddyPrompt = ai.definePrompt({
  name: 'studyBuddyPrompt',
  input: {schema: StudyBuddyInputSchema},
  output: {schema: StudyBuddyOutputSchema},
  prompt: `You are a helpful and empathetic AI study buddy. Your role is to provide personalized, actionable advice to students. You have been given a comprehensive knowledge base with specific strategies for common student challenges.

  **Task:**
  First, analyze the user's input to determine their intent.

  1.  **If the user is asking for a study plan:** This is the primary function. The user will provide a \`studyTopic\`, \`studyGoals\`, and a \`currentIssue\`. Provide a tailored study plan. Address their "Current Issue" directly and integrate relevant strategies from the knowledge base below. The \`additionalAdvice\` section MUST be structured with bolded headings for **Physical**, **Intellectual**, and **Emotional** advice.

  2.  **If the user asks a direct question:** The user might ask a specific question in the "currentIssue" field (e.g., "why did they do that step in the proof?" or "what is 5+6?"). If the query is a request for information rather than study advice, provide a direct, helpful answer to that question in the \`additionalAdvice\` field. In this case, you should NOT use the Physical/Intellectual/Emotional structure. The other fields (\`studyTechniques\`, \`timeManagementStrategies\`) can contain short, placeholder text.

  **Student Information:**
  - **Study Topic:** {{{studyTopic}}}
  - **Study Goals:** {{{studyGoals}}}
  - **Current Issue:** {{{currentIssue}}}
  - **Exam Date:** {{examDate}}


  **Knowledge Base (Use this to provide detailed, specific advice):**
  """
Svårt att starta
Fysiskt
Energi
Har du ätit, sovit och rört dig tillräckligt idag? Det är alltid det första man ska undersöka då det är grunden till allt. Även om många studenter inte har stora budgets kan det vara värt att prioritera en varierad kost. Vill man spara kan man göra det mer efter studierna då man tjänar mer eller prioritera bort andra kostnader. Utan bra mat kommer man inte att orka långt. Några snabba knep att återställa grundbehoven innan ett studiepass är att äta något hälsosamt så du får energi under en längre tid, ta en promenad eller annan form av träning (gym, klass, onlinepass) för att vakna eller att ta en kortare 20 minuter powernap, vila är inte utbytbart. Sedan finns det snabbare korttidslösningar som att dricka kaffe, äta ditt favoritsnack eller ta en dusch för att ändra sinnesinställning. 

Sedan är det också värt att läsa igenom “pass 1” som berättar mer om smart planering, där huvudpoängen här handlar om att studera när du har som mest energi - är du en morgon eller kvällsmänniska? Man kan också pröva att färglägga sin kalender i rött och grönt vad som tar och ger energi för att hitta balansen.

Ibland måste man pusha sig själv, även om energin är låg, då kan man räkna ner från tre och slänga sig in i det utan att tänka för mycket.

Verktyg
Här kommer en lista på bra saker att ha med sig i skolan eller inför ett studiepass. Välj det som applicerar för dig. Tanken är att vara så förberedd som möjligt och att ha vissa grundsaker samlat på ett ställe, till exempel i en speciell väska för att slippa tappa bort sakerna.
Kläder efter väder. För vissa fungerar det bättre att kläderna är lite obekväma för att hålla sig alerta. Kan också vara solglasögon, paraply eller regnponcho
Vattenflaska
Något att fylla på energin med, även efter lunch
Medicin som alvedon tex
Hörlurar eller öronproppar för koncentration
Kurslitteratur (alternativt online)
Kalender (alternativ online)
Anteckningsblock (alternativt online)
Pennor och suddgummi 
Dator, laddare och kanske powerbank
Busskort, nycklar, mobil 

Plats
Var du studerar kan spela stor roll. Så var ärlig om hur dina tidigare erfarenheter har varit. Här kommer några rekommendationer:

Distraktion: Tenderar du att börja fastna i saker du har omkring dig hemma eller prata med övriga personer du bor med - testa att studera någon annanstans. Tex som ett café, bibliotek eller en park.
Skjuta upp att starta/avsluta: Brukar du ha lätt att prokrastinera eller studera för länge - välja en plats som bara har öppet under ett visst tidsintervall.
Trött: Har du låg energi - prova att stanna efter skolan en stund innan du kommer hem och kraschar. Om du studerar hemma, försök undvik att sitta i sängen och testa istället köket eller vardagsrummet
Socialt ansvar: Är det svårt att hålla sig själv ansvarig - studera med en kompis eller gå med i ett videomöte med kamera på för att lättare fortsätta.
Intellektuellt
Bryt ned uppgifter genom planom planering
För att orka ta sig an stora uppgifter är det viktigt att veta vad de mindre stegen dit är så du kan fokusera på en sak i taget utan att bli överväldigad. Speciellt är det viktigt att det är tydligt vad som ska göras och hur. Goblin.tools hemsida kan hjälpa dig att bryta ner uppgifter till delsteg, estimera hur lång tid det tar, förklara svåra begrepp och göra dina att göra listor åt dig. Vissa vill börja med det svåraste för att ha det klart, andra väljer att göra något enkelt först för att orka komma igång. Du kan också maila din lärare eller prata med andra studenter via Kollins kanaler för att fråga om mer detaljer. 

Orkar du fortfarande inte kan man bryta ner förväntningarna också. Prova att studera i två minuter till exempel och se vad som händer. Oftast är det svårast att starta.

Tid
För alla är det inte lätt att uppfatta tid. Kanske kommer man försent till lektionen, orkar inte börja studera då det känns som ett oändligt högt berg eller så fastnar man i pluggandet och glömmer bort att äta. De handlar alla om samma kärna och det finns flera moderna verktyg för att lösa problemet idag.

Först och främst finns det fler sätt att visualisera tid, tex som en rad med prickar som försvinner (timstock) eller en ifylld cirkel där en liten tårtbit försvinner bit för bit (time timer). Båda dessa verktyg finns fysiskt att köpa, gratis som appar och hemsidor. Att areor minskar är lättare för vår hjärna att förstå än stora nummer. Här är en hemsida.

Larm kan vara bra för flera olika saker, tex att veta när man ska starta, att förbereda sig innan något startar eller att följa upp att man gjort det man skulle efteråt. Ifall du sätter alarm finns det också några saker att tänka på. Sätt inte för många, då kommer de inte ha effekt. Är du irriterad på ljudet av klockan och hör det ofta, byt ljud. Ha gärna larmet flera meter bort från dig så att du behöver gå och vara vaken för att stänga av det. Var försiktig med att snooza, gå inte tillbaka till för bekväma ställen där du riskerar att glömma bort tiden igen eller stänga av alarm utan att märka det.

Ytterligare en sak som kan hjälpa är att börja tajma sig själv när man gör olika saker för att få en uppfattning om vad tiden faktiskt går till. Det finns datorprogram som "Rescuetime" eller batterianvändning på mobiler som kan ge statistik på detta automatiskt. Då kan du göra ett aktivt val vad du vill att tiden ska gå till och realistiskt veta var du fastnar. 
Om du väljer att studera själv istället för att gå på en lektion, var ytterst noggrann om tiden att du läser samma tid som lektionen är. Det är väldigt lätt att hamna efter. Ett sätt att ta sig förbi det är att ha kortare och fler deadlines innan den riktiga.
Att skapa rutiner
Att ändra rutiner är bland de svårare saker vi människor kan göra. James Clear författare av “Atomic Habits”, djupdyker i detta ämne och pratar om ett par olika saker: att göra små saker i taget, att identifiera sig med de nya målen och bevisa att man klarar av det (growth mindset), göra SMARTA mål (se pass 1), att ha tålamod men framförallt att bygga system som gör vanor lättare att skapa och bibehålla. Med andra ord, att göra det man inte vill göra svåråtkomligt och det man vill göra lättåtkomligt. Över tid kommer de små målen tillsammans med enklare startsträcka att skapa disciplin som i sig fostrar självrespekt. Några knep är att: 
Ha en väska redo med material förberedda 
Planera, prioritera och bryta ner uppgifter i förväg så du vet var du ska börja
Läs i 5 minuter och var nöjd med det istället för att förvänta sig att läsa ut en hel bok
Låta en vän sätta lösenordet till det spel man har lätt att fastna i (finns också program som kan låsa appar med mera - tex Cold Turkey)
Lägg godis, snacks eller andra distraktioner på svåråtkomliga platser, till exempel höga hyllor.
Studera med andra eller sätt mål med andra att följa upp, alternativt använd egna trackers du kan kryssa i för att se dina fram-och-motgångar. 

Det kan också vara lättare att skapa nya vanor baserat på de man redan har. Tex om man brukar glömma matlådan, lägg då en tom matlåda på din sko, för det är sällan du glömmer att sätta på dig skorna innan du går ut. Eller om du vill skriva dagbok, lägg den bredvid tandborsten som en påminnelse på kvällen.
Emotionellt 

Motivation
Var får vi vår motivation ifrån då? En sak som har stor påverkan är vår dopaminnivå. Den ökar när vi förväntar oss något stimulerande tex märker doften från en kaka, sedan kommer en andra topp när vi får kakan som sist har en lika stor dipp och går tillbaka till normala värden (och tvärtom om vi märker något som inte var tillfredsställande, tex att kakan smakar illa). Med andra ord, ju större “vågor” dopamin desto större dippar. Ju fler gånger man gör den givande aktiviteten kommer dippen efteråt att växa som vi vill bli av med och kan skapa beroenden, berättar Andrew Huberman hjärnforskare och lektor på Stanford Universitet i sin video “How to increase motivation and drive”. 

Vidare berättar han att det finns två typer av prokrastinerare, de som frodas av adrenalinet från kommande deadlines och de som har en låg dopaminproduktion. Den första typen kan inducera ett liknande tillstånd som deadlines genom att tex dricka kaffe eller speciella andningstekniker som “super oxygenation breathing” medan den andra typen kan ibland gynnas av antidepressiva som ökar dopaminproduktionen. Dessa är inte direkta rekommendationer och något man alltid bör prata med sin läkare om. 

Om vi är låga på motivation finns det en märklig sak som kan hjälpa, att inte göra något alls. Att vara uttråkad är en av de mest motiverande utlösare. En annan sak som ger ännu starkare effekt är att tvinga sig själv att göra något man verkligen inte vill göra. När dippen i dopamin sker efter det jobbiga vi gjort så kommer nivån även vända uppåt efteråt, man ska säga att du ger nivåförändringen extra fart. Tex om du tycker kalla duschar eller att träna är jobbigt kan du göra det innan du faktiskt behövde göra. 


Dopamin trappan
Arbeta med “behaviour momentum" genom att börja med överkomliga saker som ger dig dopamin så att du orkar göra svårare saker. Med andra ord, “An object in motion stays in motion”. Börja med något som är enklare, roligare och som tar kortare tid, sedan något lite svårare och svårare och så vidare tills du når ditt slutmål. Ett exempel är att ta ut hunden på promenad, handla när man ändå är ute, köpa en glass till senare, komma hem och studera med glass som belöning efteråt. 


Belöning
Vår hjärna har svårt att föreställa sig saker som är långt bort i framtiden, därför behöver vi hjälpa den att hålla sig motiverad under loppets gång. Kanske efter studiepasset kan du äta ditt favoritsnack, träffa vänner efteråt eller spela det nya spelet som kommit ut. Kom dock ihåg att kortare pauser på några minuter under studiepass fortfarande är viktiga att ta.
Svårt att fortsätta
Fysiskt

Ta bort distraktioner
Är det svårt att fortsätta fokusera? Börja då med att ta bort distraktioner genom att:
Stäng av notifikationer
Blockera appar och hemsidor (tex med program som Cold Turkey)
Se över dina datorvanor med program som tex “Rescue time” som kan visa var du tillbringar mest tid och om den är produktiv eller inte.
Prova ifall att sitta ensam eller i grupp hjälper mer
Ha musik utan låttexter du känner igen (så du inte sjunger eller lyssnar med), alternativt prova naturljud, att ha tyst, white noise osv.
Skriv ned alla saker du kommer på att du vill göra under tiden. Då vet du att du kan gå till dem när du är klar utan att glömma, du har ideer till en paus och något att se fram emot.
Köp en låda som kan låsa sig själv tills en timer blir klar. Där kan man lägga undan distraktioner. 

Bra pauser
Alla har inte lätt att slappna av, koppla bort tankarna och tillåta sig själv att lita på att pauser är viktiga. De kanske istället frågar sig “hur kan jag göra pausen så effektiv som möjligt” men då har man redan kommit bort från vila. 

Vår hjärna är som en muskel och behöver vila för att kunna processa, reflektera och memorera det vi lärt oss. Vi blir också mer produktiva när vi arbetar igen då vi har mer energi, mer kreativa eftersom vi fått reflektera på annat och långsiktigt håller vi vår hälsa i schack bättre. Forskning pekar på att just små korta pauser under dagen gör stor skillnad. Om man vill kan man läsa på mer om det här. 

Speciellt för studenter är det viktigt att inte glömma livet omkring och att allt inte är en prestation. Skolan är en speciell värld, där det ställs udda krav, alla kommer inte att appliceras på arbeten senare. Tiden under skolåren är också en del av ditt liv. Om man sätter orealistiskt höga mål, kämpar hårt utan paus och sen ändå inte når målet, eller blir utbränd och kan inte göra något mer på länge, riskerar man att förlora tid. Det är som att dra i en blomma och hoppas att den ska växa fortare. Var medveten om när du väljer att arbeta och när det är värt att skynda samt när du väljer att vila för att du behöver det, annars är det risk att döma sig själv. Lev livet nu också.

Om du nu bestämt dig för att ta en paus, hur kan vi hjälpa oss själva att bli så utvilade som möjligt? 
Längd: Här pekar forskningen bland annat på att pauserna ska vara kortare, annars riskerar vi att bli trötta eller uttråkade (se här). Forskare skriver också i “Applied Psychology" (här) att mikropauser är givande, tex som att dricka något, stretcha eller klappa en katt. Ju tidigare du tar pauser desto mer kommer du orka under dagen. Med det sagt behöver vi självklart längre pauser efter studierna, arbetar du hårt behöver du vila extra.

Timing: Vi behöver som tidigare nämnt flera kortare pauser utspritt över dagen. Till exempel, en på morgonen, en vid lunch och en vid eftermiddagen. Om du känner att du är på väg att få huvudvärk, har fastnat länge på en uppgift eller tappar lätt koncentrationen, då är det dags att pausa. Om du är i ett “flow state” och lätt tar dig vidare.

Vad ska man göra: För att fylla på med energi behöver vi äta, sträcka på oss och titta på något annat än våra skärmar. Speciellt om du tillbringar mycket tid med skärmar är pauser viktiga för att motverka huvudvärk. Det finns olika saker vi kan behöva vila från: fysiskt, mentalt, socialt (i verkligheten och sociala medier), sensorisk och kreativ vila. Ofta behöver vi göra motsatsen en stund. Några exempel på vad olika pauser ger:

Fysisk paus
Ät ett snack och ta något att dricka
Spela din favoritlåt och dansa loss! 
Mental paus
Ta en tupplur. Här rekommenderar forskning cirka 20 minuter
Dagdröm
Mindfulness eller yoga
Studera något helt annat ämne (tex praktiskt vs teoretiskt) 
Social paus
Prata med en vän, kollega eller familjemedlem på plats. Se till att hålla koll på tiden här
Finns ingen på plats, skriv online eller förbered en social rolig aktivitet till efter jobbet
Sensorisk paus
Gå ut i naturen och få motion, frisk luft och tystnad
Hitta ett tystare, mörkare rum och lyssna på omgivningen
Kreativ paus
Rita en annan värld än du är i just nu
Skriv dagbok, dikter eller uppmuntringar till dig själv
Lyssna på musik och sjung med
Här fins ytterligare tips på hur du kan identifiera dina behov: https://philome.la/jace_harr/you-feel-like-shit-an-interactive-self-care-guide/play/index.html 

Balans: För att inte glömma bort tiden och låta pauserna ta över tid planerat till annat är det bra att ha en timer för pauserna, till exempel pomodoro timers med intervaller. Om du och andra sidan fortfarande har svårt att tillåta pauser även om du vill ha dem, skriv in dem som en uppgift i kalendern. Sannolikt har du då även lättare för aktiv vila (som att gå på promenad) än passiv vila (som att ta en powernap). 

Intellektuellt 

Träna ditt fokus
Använd timers med intervall, som pomodoro, och sätt långsamt längre intervall eller kortare pauser. Om det har varit en hektisk och stressig period kan vår koncentrationsförmåga minska av trötthet, om vi inte har studerat under en längre tid kommer färskvaran också tappas eller om vi sovit dåligt. Så se till att vara rimlig, tålmodig och hoppfull, det går att träna tillbaka. 

Rimlighet
Att veta vad som är rimligt är allt annat än lätt men bland det viktigaste för att orka starta, fortsätta och stoppa i tid. Som tidigare beskrivit i kapitlet om mål samt “pass 1” finns det flera tips hur du planerar rimligt baserat på ditt mående och tendenser - LÄNK. Här kommer några fler bra generella regler som kan bli mycket effektfulla:
Sätt små mål, testa sen mindre om du inte nått målen eller större om det var för enkelt.
Gör bara en sak i taget. Det hjälper fokus, stress och effektiviteten.
Vila. Skippa ej ta hand om dig, det är också plugg speciellt att inte vara i huvudet hela tiden utan fysiskt (yoga, dans, skateboard, brottas), relationer och trygghet från terapi och boendestödjaren rutiner. Planeringen ger dig balans.
Tänk på ställtid:
Att byta mellan arbetsuppgifter tar tid på grund av det fysiska och mentala.
Att lämna anteckningar, kod eller text i bra skick är viktigt för att kunna veta var man avslutade senast. Alternativt skriv en hitta tillbaka guide.
När man frågar om hjälp tar det tid att hitta rätt person, att den ska ha tid och att vänta på svar.
Emotionellt 

Socialt ansvar
Att ha en "Accountability buddy” kan hjälpa många, både de som vill studera mer och de som behöver hjälp att sätta stopp och planera in pauser. Möten med en sådan person kan innebära en tidigare deadline man har satt, att ha någon att diskutera med det man fastnat på, att planera vad som kommer härnäst och att göra det första steget till att börja studera mindre läskigt. 

Att studera tillsammans är också en gyllene stund att få feedback från varandra och testa varandras kunskap, gärna hur man kan förbättra den och inte bara vad som inte fungerar. 

Det är ofta också lättare att bry sig om andra, och medan det är viktigt att göra saker för en själv, kan detta vara en bra start för att komma i rullning. För att hitta rätt person och veta var man ska leta erbjuder Kollin färdiga mallar och en plats att annonsera sig själv som sökande efter en accountability buddy. 

Om du inte har någon du kan träffa i verkligheten, kan du dela din skärm eller ha på en videokamera när du studerar tillsammans med andra, alternativt lägga ut en annons att du letar efter en accountability buddy. Båda dessa tjänster erbjuder Kollin på sin discord. 

Ha ett tydligt mål
Var tydlig långsiktigt och kortsiktigt med varför du vill nå ditt mål och sätt det på ett ställe där det syns. Alternativt kan du också sätta upp en bild på någon du ser upp till, det kan vara allt från riktiga personer till en seriefigur som tilltalar dig. Att ha en färdig spellista med musik som får dig att känna dig kompetent, cool eller lugn kan också vara ett stöd. Läs gärna igenom första delen av detta dokument (underrubrik mål) för mer detaljer och exempel - LÄNK. Sätt också hellre för låga mål än för höga, då är det mer sannolikt att du startar, blir nöjd och orkar mer.
Svårt att avsluta
Fysiskt
Förvarning
Använd dig av en klocka som ringer när det är dags att stoppa. Se tex rekommendation för hur långa passen ska vara, tex 90 minuter och gå inte över det. Kanske är du mitt uppe i något då och behöver avsluta, tillåt det i ca 15 minuter men dra inte över mer än så. När larmet går andra gången då får man dra en hård gräns att släppa bok och penna. Går du runt och tänker fortfarande på uppgiften, hitta en distraktion istället. Med tiden lär man sig att hålla sig inom den tidsram man har.
Intellektuellt
Förbered nästa pass
Att skriva ner en punktlista vad du ska göra till nästa gång kan bli en naturlig övergång till att inte gå igenom något mer för dagen, göra det lättare att släppa studierna och dessutom hjälper dig inför nästa studiepass. Vill du så kan du också skriva ner flashcards, frågor du vill ställa läraren till nästa lektion eller koncept du vill läsa mer om. Nyckeln är dock att bestämma sig i förväg vilken metod man ska använda för att testa fler och fler utan stopp under studiepasset. 
Emotionellt
Socialt ansvarstagande
Som tidigare nämnt kan en pluggkompis eller "accountability buddy” också hjälpa när det gäller att avsluta pass. När man planerar tillsammans kan de se till att man får in tillräckligt med pauser och gör ett rimligt schema för sig själv. Man kan också föreställa sig att man skulle ge sitt schema till den andra personen, vore det rättvist? Redigera.

Stanna upp
Andrew Huberman berättar också i sin video “How to increase motivation and drive” att dem som har höga dopaminnivåer kan ibland istället ha svårt att avsluta, ha svårt att ta det lugnt, inte vara nöjda och vilja ha fler mål. Det viktiga är att förstå att dopamin inte ges av förväntan och inte bara att få det som känns bra. Med andra ord, dopamin får dig att vilja ha fler dopaminsökande saker. För de personerna kan det vara viktigt att vara i nuet tex genom meditation och kunna lyssna på kroppen. Både genom korta pauser under tiden som nämnt “svårt att fortsätta" och efteråt. Några ledtrådar att leta efter kan vara: har du huvudvärk eller ont i axlarna? Börjar du bli avsevärt långsammare? Är det svårt att göra val och vara kreativ? Här finns fler frågor.
  """

  **Output Format:**
  Return the result as a valid JSON object matching the defined schema.
  - **studyTechniques:** Suggest techniques tailored to the student's goals and current issue.
  - **timeManagementStrategies:** Provide time management advice, referencing the knowledge base.
  - **additionalAdvice:** Give holistic advice for physical, intellectual, and emotional well-being, using the knowledge base. This must be formatted with bolded subheadings for Physical, Intellectual, and Emotional sections.
  `,
});

const studyBuddyRecommendationsFlow = ai.defineFlow(
  {
    name: 'studyBuddyRecommendationsFlow',
    inputSchema: StudyBuddyInputSchema,
    outputSchema: StudyBuddyOutputSchema,
  },
  async input => {
    const {output} = await studyBuddyPrompt(input);
    return output!;
  }
);
