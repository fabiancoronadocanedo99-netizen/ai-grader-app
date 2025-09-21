import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API Route de test iniciada');
    
    const body = await request.json();
    console.log('📋 Body recibido:', body);
    
    const { gradeId } = body;
    if (!gradeId) {
      return NextResponse.json(
        { error: 'No se proporcionó gradeId' }, 
        { status: 400 }
      );
    }

    console.log(`✅ API Route funcionando - gradeId: ${gradeId}`);

    return NextResponse.json({
      success: true,
      message: 'API Route de Next.js funcionando correctamente',
      receivedId: gradeId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en API Route:', error);
    return NextResponse.json(
      { 
        error: (error as Error).message,
        details: 'Error en API Route de Next.js'
      }, 
      { status: 500 }
    );
  }
}