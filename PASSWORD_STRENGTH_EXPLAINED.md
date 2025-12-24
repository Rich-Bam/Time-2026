# Password Strength Check - Uitleg

## Wat is HaveIBeenPwned?

**HaveIBeenPwned** is een service van security expert Troy Hunt die een database beheert met **honderden miljoenen wachtwoorden** die zijn gelekt in datalekken.

### Voorbeeld:
Als een website zoals LinkedIn, Adobe, of Facebook wordt gehackt en wachtwoorden worden gestolen, komen die wachtwoorden in de HaveIBeenPwned database.

## Hoe werkt de API?

### Pwned Passwords API
De API controleert of een wachtwoord voorkomt in de database van gecompromitteerde wachtwoorden.

**Belangrijk:** De API werkt met **hashes** (SHA-1) van wachtwoorden, niet met de wachtwoorden zelf. Dit betekent:
- Je stuurt **niet** het volledige wachtwoord naar de API
- Je stuurt alleen de **eerste 5 karakters** van de hash
- De API geeft een lijst terug van hashes die beginnen met die 5 karakters
- Je controleert lokaal of jouw volledige hash in die lijst staat

### Privacy & Security
- ✅ Je wachtwoord wordt **niet** volledig naar de API gestuurd
- ✅ Alleen de eerste 5 karakters van de hash worden gedeeld
- ✅ De API kan niet zien welk wachtwoord je controleert
- ✅ Het is veilig om client-side te gebruiken

## Client-side vs Server-side

### Client-side (in de browser/app)
```
Gebruiker typt wachtwoord → App controleert tegen API → Toont waarschuwing
```

**Voordelen:**
- ✅ Snel (geen server nodig)
- ✅ Eenvoudig te implementeren
- ✅ Geen extra server kosten

**Nadelen:**
- ⚠️ Gebruiker kan de check omzeilen (maar dat is ok, het is alleen een waarschuwing)
- ⚠️ API call gaat direct vanuit browser

### Server-side (via edge function)
```
Gebruiker typt wachtwoord → Stuurt naar server → Server controleert → Server geeft antwoord
```

**Voordelen:**
- ✅ Gebruiker kan check niet omzeilen
- ✅ Meer controle

**Nadelen:**
- ⚠️ Meer complexiteit
- ⚠️ Extra server call nodig

## Hoe werkt het in de praktijk?

### Stap 1: Gebruiker typt wachtwoord
```
Gebruiker: "password123"
```

### Stap 2: App maakt SHA-1 hash
```javascript
const hash = sha1("password123");
// Resultaat: "CBFDAC6008F9CAB4083784CBD1874F76618D2A97"
```

### Stap 3: Neem eerste 5 karakters
```javascript
const prefix = hash.substring(0, 5);
// Resultaat: "CBFDA"
```

### Stap 4: Vraag API om alle hashes die beginnen met "CBFDA"
```javascript
const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
// API geeft terug: lijst van alle hashes die beginnen met "CBFDA"
```

### Stap 5: Check lokaal of jouw volledige hash in de lijst staat
```javascript
if (hashFoundInList) {
  // Toon waarschuwing: "Dit wachtwoord is gecompromitteerd!"
}
```

## Voorbeeld Implementatie

```typescript
async function checkPasswordAgainstPwned(password: string): Promise<boolean> {
  // 1. Maak SHA-1 hash van wachtwoord
  const hash = await sha1(password);
  
  // 2. Neem eerste 5 karakters
  const prefix = hash.substring(0, 5).toUpperCase();
  const suffix = hash.substring(5).toUpperCase();
  
  // 3. Vraag API om alle hashes met deze prefix
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await response.text();
  
  // 4. Parse de response (lijst van hashes)
  const hashes = text.split('\n').map(line => line.split(':')[0]);
  
  // 5. Check of jouw suffix in de lijst staat
  return hashes.includes(suffix);
}

// Gebruik:
const isPwned = await checkPasswordAgainstPwned("password123");
if (isPwned) {
  alert("⚠️ Dit wachtwoord is gecompromitteerd! Gebruik een ander wachtwoord.");
}
```

## Waarom is dit nuttig?

### Voorkomt zwakke wachtwoorden
Als een gebruiker "password123" wil gebruiken:
- ✅ Check detecteert dat dit wachtwoord in de database staat
- ✅ App toont waarschuwing: "Dit wachtwoord is gecompromitteerd"
- ✅ Gebruiker wordt aangemoedigd een sterker wachtwoord te kiezen

### Real-world voorbeeld
```
Gebruiker: "Welkom123"
→ Check: Dit wachtwoord staat in 1.234.567 datalekken
→ Waarschuwing: "Dit wachtwoord is niet veilig, kies een ander"
```

## Wat betekent "client-side"?

**Client-side** betekent dat de check gebeurt in de **browser/app** van de gebruiker, niet op een server.

### Client-side flow:
```
Browser → HaveIBeenPwned API → Browser
```

### Server-side flow:
```
Browser → Jouw Server → HaveIBeenPwned API → Jouw Server → Browser
```

## Is het veilig om client-side te doen?

**Ja!** Omdat:
1. ✅ Alleen hash prefix wordt gedeeld (niet het wachtwoord)
2. ✅ API kan niet zien welk wachtwoord je controleert
3. ✅ Het is een publieke service, gebruikt door miljoenen websites
4. ✅ Zelfs Microsoft gebruikt deze service client-side

## Samenvatting

**HaveIBeenPwned API:**
- Database van gecompromitteerde wachtwoorden
- Controleert of wachtwoord in datalekken voorkomt
- Werkt met hashes (veilig)
- Gratis en publiek beschikbaar

**Client-side check:**
- Gebeurt in de browser/app
- Snel en eenvoudig
- Veilig (alleen hash prefix wordt gedeeld)
- Gebruiker krijgt direct feedback

**Resultaat:**
- Gebruikers worden gewaarschuwd als ze een gecompromitteerd wachtwoord kiezen
- Betere beveiliging zonder complexiteit

