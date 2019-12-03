import { format, parseISO } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Mail from '../../lib/Mail';

class CancellationMail {
  get key() {
    return 'CancellationMail';
  }

  async handle({ data }) {
    const { apointment } = data;
    await Mail.sendMail({
      to: `${apointment.provider.name} <${apointment.provider.email}>`,
      subject: 'Agendamento Cancelado',
      template: 'cancellation',
      context: {
        provider: apointment.provider.name,
        user: apointment.user.name,
        date: format(
          parseISO(apointment.date),
          "'dia' dd 'de' MMMM', às' H:mm'h'",
          {
            locale: pt,
          }
        ),
      },
    });
  }
}

export default new CancellationMail();
