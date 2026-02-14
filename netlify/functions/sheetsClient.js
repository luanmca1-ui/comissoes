import { google } from 'googleapis';

const REQUIRED_ENVS = ['GOOGLE_SHEETS_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'];

function assertEnv() {
  for (const key of REQUIRED_ENVS) {
    if (!process.env[key]) {
      throw new Error(`Env ausente: ${key}`);
    }
  }
}

function getClient() {
  assertEnv();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getValues(range) {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return data.values || [];
}

export async function appendValues(range, rows) {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

export async function updateValues(range, values) {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function findRowByKey(sheetName, keyHeader, keyValue) {
  const rows = await getValues(`${sheetName}!A:ZZ`);
  if (!rows.length) return { rowIndex: -1, row: null, headers: [] };

  const headers = rows[0];
  const keyIndex = headers.indexOf(keyHeader);
  if (keyIndex === -1) return { rowIndex: -1, row: null, headers };

  for (let i = 1; i < rows.length; i += 1) {
    if ((rows[i][keyIndex] || '') === keyValue) {
      return { rowIndex: i + 1, row: rows[i], headers };
    }
  }

  return { rowIndex: -1, row: null, headers };
}

export async function ensureSheetWithHeader(sheetName, header) {
  const sheets = getClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties?.title));

  if (!existing.has(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  }

  const current = await getValues(`${sheetName}!A1:ZZ1`);
  if (!current.length || !current[0].length) {
    await updateValues(`${sheetName}!A1`, [header]);
    return;
  }

  const existingHeader = current[0];
  const missing = header.filter((h) => !existingHeader.includes(h));
  if (missing.length) {
    const merged = [...existingHeader, ...missing];
    await updateValues(`${sheetName}!A1`, [merged]);
  }
}