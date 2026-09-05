function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Create timestamp
    const timestamp = new Date();
    
    // Prepare row data
    const rowData = [
      timestamp,
      data.firstName,
      data.lastName,
      data.email,
      data.pieType,
      data.eventDate
    ];
    
    // Append the data to the sheet
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Data saved successfully' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    console.log('GET request received with parameters:', e.parameter);
    
    // Check if this is an email lookup request
    if (e && e.parameter && e.parameter.action === 'checkEmail' && e.parameter.email) {
      console.log('Processing email check for:', e.parameter.email);
      
      const email = e.parameter.email.toLowerCase().trim();
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      
      // Get all data from the sheet
      const data = sheet.getDataRange().getValues();
      console.log('Sheet has', data.length, 'rows');
      
      // Skip header row (row 0) and check each row
      for (let i = 1; i < data.length; i++) {
        const rowEmail = data[i][3]; // Email is in column D (index 3)
        const rowPieType = data[i][4]; // Pie Type is in column E (index 4)
        
        console.log('Checking row', i, 'email:', rowEmail, 'pie:', rowPieType);
        
        if (rowEmail && rowEmail.toLowerCase().trim() === email) {
          // Email found, return the pie type
          console.log('Email found! Returning pie type:', rowPieType);
          return ContentService
            .createTextOutput(JSON.stringify({ 
              exists: true, 
              pieType: rowPieType,
              message: 'Email already registered'
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      // Email not found
      console.log('Email not found in sheet');
      return ContentService
        .createTextOutput(JSON.stringify({ 
          exists: false, 
          message: 'Email not found'
        }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } 
    // Check if this is a pie counts request
    else if (e && e.parameter && e.parameter.action === 'getPieCounts') {
      console.log('Processing pie counts request');
      
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      const data = sheet.getDataRange().getValues();
      
      let sweetCount = 0;
      let savoryCount = 0;
      
      // Skip header row (row 0) and count pie types
      for (let i = 1; i < data.length; i++) {
        const rowPieType = data[i][4]; // Pie Type is in column E (index 4)
        
        if (rowPieType) {
          const pieType = rowPieType.toLowerCase().trim();
          if (pieType === 'sweet') {
            sweetCount++;
          } else if (pieType === 'savoury' || pieType === 'savory') {
            savoryCount++;
          }
        }
      }
      
      // Total counts every registered row (including Wild Card picks),
      // so registrant position numbers stay accurate even after a wild card slot.
      const total = data.length - 1;
      
      console.log('Pie counts - Sweet:', sweetCount, 'Savory:', savoryCount, 'Total:', total);
      
      return ContentService
        .createTextOutput(JSON.stringify({ 
          sweetCount: sweetCount,
          savoryCount: savoryCount,
          total: total,
          message: 'Pie counts retrieved successfully'
        }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else {
      // Default response for basic GET requests or missing parameters
      console.log('No specific action parameters found, returning default response');
      return ContentService
        .createTextOutput(JSON.stringify({
          message: 'Pie Night 2026 API is running',
          availableActions: ['checkEmail', 'getPieCounts'],
          parameters: e.parameter || 'No parameters'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.log('Error in doGet:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
