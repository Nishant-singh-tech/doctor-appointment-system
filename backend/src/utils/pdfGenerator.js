import PDFDocument from 'pdfkit';

/**
 * Generate a clean, professional medical prescription PDF document
 * @param {Object} prescription - Populated prescription object with doctor, patient, appointment
 * @param {Object} res - Express response stream
 */
export const generatePrescriptionPDF = (prescription, res) => {
    const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
            Title: `Prescription-${prescription.prescriptionNumber}`,
            Author: prescription.doctor?.name || 'DocCare Medical Specialist',
            Subject: 'Medical Digital Prescription',
            Keywords: 'Prescription, Medical, Healthcare, DocCare'
        }
    });

    // Pipe PDF to the Express HTTP response
    doc.pipe(res);

    const primaryColor = '#1d4ed8'; // Blue
    const darkColor = '#1e293b';    // Slate 800
    const grayColor = '#64748b';    // Slate 500
    const lightBg = '#f8fafc';      // Slate 50

    // ==========================================
    // 1. CLINIC / HOSPITAL HEADER
    // ==========================================
    doc.rect(40, 40, 515, 65).fill(lightBg);

    doc.fillColor(primaryColor)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('DocCare Healthcare System', 55, 52);

    doc.fillColor(grayColor)
        .fontSize(9)
        .font('Helvetica')
        .text('Official Digital Medical Prescription • Telehealth & Clinical Care', 55, 76);

    doc.fillColor(darkColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Prescription No: ${prescription.prescriptionNumber}`, 360, 52, { align: 'right' });

    doc.fillColor(grayColor)
        .fontSize(8)
        .font('Helvetica')
        .text(`Issued Date: ${new Date(prescription.createdAt || Date.now()).toLocaleDateString()}`, 360, 68, { align: 'right' });

    doc.moveDown(2);

    // ==========================================
    // 2. DOCTOR & PATIENT INFORMATION SECTION
    // ==========================================
    const doctorY = 120;

    // Left Column: Doctor Profile
    doc.fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('PRESCRIBING PHYSICIAN', 50, doctorY);

    doc.fillColor(darkColor)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(prescription.doctor?.name || 'Physician', 50, doctorY + 16);

    doc.fillColor(grayColor)
        .fontSize(9)
        .font('Helvetica')
        .text(`${prescription.doctor?.specialization || 'Medical Specialist'}`, 50, doctorY + 32)
        .text(`Qualifications: ${prescription.doctor?.qualifications || 'MBBS, Certified MD'}`, 50, doctorY + 45)
        .text(`Hospital: ${prescription.doctor?.hospital || prescription.doctor?.location || 'DocCare Specialist Center'}`, 50, doctorY + 58);

    // Right Column: Patient Profile
    doc.fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('PATIENT DETAILS', 320, doctorY);

    doc.fillColor(darkColor)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(prescription.patient?.name || 'Patient', 320, doctorY + 16);

    const genderAge = [
        prescription.patient?.gender ? `Gender: ${prescription.patient.gender.toUpperCase()}` : null,
        prescription.patient?.bloodGroup ? `Blood: ${prescription.patient.bloodGroup}` : null
    ].filter(Boolean).join(' • ') || 'Registered Patient';

    doc.fillColor(grayColor)
        .fontSize(9)
        .font('Helvetica')
        .text(genderAge, 320, doctorY + 32)
        .text(`Phone: ${prescription.patient?.phone || 'On file'}`, 320, doctorY + 45)
        .text(`Consultation Date: ${prescription.appointment?.date || 'N/A'} (${prescription.appointment?.timeSlot || ''})`, 320, doctorY + 58);

    // Horizontal separator line
    doc.strokeColor('#e2e8f0')
        .lineWidth(1)
        .moveTo(40, 200)
        .lineTo(555, 200)
        .stroke();

    // ==========================================
    // 3. CLINICAL DIAGNOSIS & SYMPTOMS
    // ==========================================
    doc.fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('CLINICAL DIAGNOSIS', 50, 215);

    doc.fillColor(darkColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(prescription.diagnosis, 50, 230);

    if (prescription.symptoms) {
        doc.fillColor(grayColor)
            .fontSize(9)
            .font('Helvetica')
            .text(`Reported Symptoms: ${prescription.symptoms}`, 50, 248);
    }

    // ==========================================
    // 4. MEDICINES & RX TABLE
    // ==========================================
    const tableTop = prescription.symptoms ? 275 : 260;

    // Rx Symbol
    doc.fillColor(primaryColor)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('℞', 50, tableTop - 5);

    doc.fillColor(darkColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Medications & Regimen', 75, tableTop + 3);

    // Table Header
    const headerY = tableTop + 24;
    doc.rect(40, headerY, 515, 22).fill('#f1f5f9');

    doc.fillColor('#334155')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('#', 50, headerY + 7)
        .text('MEDICINE & STRENGTH', 70, headerY + 7)
        .text('DOSAGE', 230, headerY + 7)
        .text('FREQUENCY', 300, headerY + 7)
        .text('DURATION', 390, headerY + 7)
        .text('INSTRUCTIONS', 460, headerY + 7);

    let currentY = headerY + 22;

    (prescription.medicines || []).forEach((med, index) => {
        // Row background alternating
        if (index % 2 === 1) {
            doc.rect(40, currentY, 515, 26).fill('#f8fafc');
        }

        doc.fillColor(darkColor)
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .text(`${index + 1}.`, 50, currentY + 7)
            .text(med.name || 'Medicine', 70, currentY + 7, { width: 155, ellipsis: true });

        doc.font('Helvetica')
            .text(med.dosage || '1 unit', 230, currentY + 7)
            .text(med.frequency || 'Daily', 300, currentY + 7)
            .text(med.duration || '5 days', 390, currentY + 7)
            .text(med.instructions || 'As advised', 460, currentY + 7, { width: 90, ellipsis: true });

        currentY += 26;
    });

    currentY += 15;

    // ==========================================
    // 5. ADVICE & FOLLOW-UP INSTRUCTIONS
    // ==========================================
    doc.rect(40, currentY, 515, 60).fill('#f8fafc');
    doc.rect(40, currentY, 515, 60).strokeColor('#e2e8f0').lineWidth(1).stroke();

    doc.fillColor(primaryColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('GENERAL ADVICE & INSTRUCTIONS', 50, currentY + 10);

    doc.fillColor(darkColor)
        .fontSize(8.5)
        .font('Helvetica')
        .text(prescription.advice || 'Follow medication schedule carefully and maintain adequate hydration.', 50, currentY + 24, { width: 495 });

    if (prescription.followUpDate) {
        doc.fillColor(primaryColor)
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .text(`Follow-up Consultation: ${prescription.followUpDate}`, 50, currentY + 44);
    }

    // ==========================================
    // 6. DOCTOR DIGITAL SIGNATURE & STAMP
    // ==========================================
    const footerY = 700;

    doc.strokeColor('#cbd5e1')
        .lineWidth(1)
        .moveTo(370, footerY)
        .lineTo(540, footerY)
        .stroke();

    doc.fillColor(darkColor)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(prescription.doctor?.name || 'Dr. Specialist', 370, footerY + 6, { align: 'center', width: 170 });

    doc.fillColor(grayColor)
        .fontSize(7.5)
        .font('Helvetica')
        .text('Authorized Digital Signature', 370, footerY + 18, { align: 'center', width: 170 })
        .text(`Issued: ${new Date(prescription.createdAt || Date.now()).toLocaleString()}`, 370, footerY + 28, { align: 'center', width: 170 });

    // Official verification watermark/disclaimer
    doc.fillColor('#94a3b8')
        .fontSize(7)
        .text('This is a verified computer-generated medical prescription issued via the DocCare Healthcare Platform.', 40, 770, { align: 'center', width: 515 })
        .text('Valid for dispensing by registered pharmacies under Digital Prescription & Telemedicine Practice Guidelines.', 40, 780, { align: 'center', width: 515 });

    doc.end();
};

