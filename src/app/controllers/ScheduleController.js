import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { Op } from 'sequelize';
import Apointment from '../models/Apointment';
import User from '../models/User';

class ScheduleController {
  async index(req, res) {
    const checkUserProvider = await User.findOne({
      where: {
        id: req.userId,
        provider: true,
      },
    });

    if (!checkUserProvider) {
      return res.status(401).json({ error: 'User is not a provider' });
    }
    const { date } = req.query;
    const parsedDate = parseISO(date);

    const apointments = await Apointment.findAll({
      where: {
        provider_id: req.userId,
        cancelled_at: null,
        date: {
          [Op.between]: [startOfDay(parsedDate), endOfDay(parsedDate)],
        },
      },
      order: ['date'],
    });
    return res.json(apointments);
  }
}

export default new ScheduleController();
