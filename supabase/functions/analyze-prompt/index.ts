import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simplified system prompt - removed architecture section since we derive it from technologies
const systemPrompt = `Sei un Senior Software Engineer e Product Architect specializzato in analisi di specifiche tecniche per web application. Analizza il prompt dell'utente e restituisci una valutazione professionale strutturata.

DEVI restituire una risposta JSON valida con questa struttura esatta:

{
  "overallScore": <numero 0-100>,
  "dimensions": [
    {
      "id": "<stringa univoca>",
      "name": "<nome dimensione in italiano>",
      "score": <numero 1-10>,
      "maxScore": 10,
      "reasoning": "<spiegazione breve del punteggio>",
      "missing": ["<elementi mancanti>"],
      "improvements": ["<suggerimenti concreti>"],
      "icon": "<emoji>"
    }
  ],
  "strengthsWeaknesses": [
    {
      "id": "<stringa univoca>",
      "type": "<strength|weakness|assumption>",
      "title": "<titolo breve>",
      "description": "<descrizione breve>"
    }
  ],
  "optimizedPrompt": "<versione migliorata del prompt in markdown>",
  "technologies": [
    {
      "category": "<categoria>",
      "primary": {
        "name": "<nome tecnologia>",
        "reason": "<motivazione breve>",
        "pros": ["<vantaggio>"],
        "cons": ["<svantaggio>"]
      },
      "alternative": {
        "name": "<alternativa>",
        "reason": "<motivazione>",
        "whenToUse": "<quando usarla>"
      }
    }
  ],
  "vibeCodingPractices": [
    {
      "id": "<id>",
      "category": "<categoria>",
      "title": "<titolo>",
      "description": "<descrizione>",
      "examples": ["<esempio>"]
    }
  ],
  "architecturePractices": [
    {
      "id": "<id>",
      "category": "<categoria>",
      "title": "<titolo>",
      "description": "<descrizione>",
      "examples": ["<esempio>"],
      "relatedIssues": ["<problema correlato>"]
    }
  ]
}

DIMENSIONI DA VALUTARE (tutte obbligatorie, 8 totali):
1. Chiarezza dell'Obiettivo (🎯)
2. Completezza Funzionale (📋)
3. Definizione Target Utente (👥)
4. Vincoli Tecnici (⚙️)
5. Considerazioni Scalabilità (📈)
6. Considerazioni Sicurezza (🔒)
7. Manutenibilità (🔧)
8. Consapevolezza Architetturale (🏗️)

CATEGORIE STACK TECNOLOGICO (TUTTE OBBLIGATORIE - ESATTAMENTE 6):
1. "Frontend" - React, Next.js, Vue, Angular
2. "Styling" - Tailwind CSS, CSS Modules, Styled Components
3. "Backend" - Node.js, Edge Functions, Express
4. "Database" - PostgreSQL, Supabase, MongoDB
5. "Autenticazione" - Supabase Auth, Clerk, Auth0
6. "Hosting" - Vercel, Netlify, AWS

REGOLE IMPORTANTI:
- Includi SEMPRE tutte e 6 le categorie tecnologiche
- Usa ESATTAMENTE questi nomi di categoria
- Rispondi SOLO con JSON valido, nessun testo prima o dopo
- Sii conciso nelle descrizioni (max 2 frasi per campo)
- Identifica almeno 3 punti di forza e 3 debolezze`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing prompt:", prompt.substring(0, 100) + "...");

    // Create abort controller with 55 second timeout (edge functions have 60s limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analizza questo prompt per una web app:\n\n${prompt}` }
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("AI request timed out");
        return new Response(
          JSON.stringify({ error: "L'analisi sta richiedendo troppo tempo. Riprova con un prompt più breve." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw fetchError;
    }
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No analysis generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response, handling potential markdown code blocks
    let analysisResult;
    try {
      let jsonContent = content.trim();
      // Remove markdown code blocks if present
      if (jsonContent.startsWith("```json")) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith("```")) {
        jsonContent = jsonContent.slice(0, -3);
      }
      analysisResult = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError, content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse analysis result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis completed successfully");

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analyze prompt error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
