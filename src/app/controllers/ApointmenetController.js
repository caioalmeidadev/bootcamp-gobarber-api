import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Apointment from '../models/Apointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../Schemas/Notification';
import Queue from '../../lib/Queue';
import CancellationMail from '../Jobs/CancellationMail';

class ApointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;
    const apointments = await Apointment.findAll({
      where: {
        user_id: req.userId,
        cancelled_at: null,
      },
      order: ['date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: {
            model: File,
            as: 'avatar',
            attributes: ['id', 'path', 'url'],
          },
        },
      ],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
    });
    res.json(apointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }
    const { provider_id, date } = req.body;
    /**
     * Chekc if user is provider
     */

    if (req.userId === provider_id) {
      return res
        .status(400)
        .json({ error: 'Provider can not create appointment to him self' });
    }

    /**
     * Check if provider exits and if is a provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create apointments with providers' });
    }

    /*
      Check for past dates
    */
    const hourStart = startOfHour(parseISO(date));
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past Date not Permmited' });
    }

    /**
     * Check date availability
     */

    const checkAvailability = await Apointment.findOne({
      where: {
        provider_id,
        cancelled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      res.status(400).json({ error: 'Apointment Data not available' });
    }

    const apointment = await Apointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    /**
     * Notify apointment Provider
     */

    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para o ${formattedDate}`,
      user: provider_id,
    });
    return res.json(apointment);
  }

  async delete(req, res) {
    const apointment = await Apointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (apointment.user_id !== req.userId) {
      return res
        .status(401)
        .json({ error: "You don't have permission to cancel this apointment" });
    }

    const dateWithSub = subHours(apointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel apointment in 2 hours in advance',
      });
    }

    apointment.cancelled_at = new Date();

    await apointment.save();

    await Queue.add(CancellationMail.key, { apointment });

    return res.json(apointment);
  }
}

export default new ApointmentController();
